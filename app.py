from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, send_from_directory
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import base64
import requests
import os
import logging
import re
import smtplib
import random
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.mime.base import MIMEBase
from email import encoders
import datetime
from PIL import Image
import io
import traceback

app = Flask(__name__)

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables from .env
load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
EMAIL_SENDER = os.getenv("EMAIL_SENDER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "your-secret-key-here")
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join('static', 'uploads')
app.config['PROFILE_PICS_FOLDER'] = os.path.join(app.config['UPLOAD_FOLDER'], 'profile_pics')
app.config['MESSAGES_FOLDER'] = os.path.join(app.config['UPLOAD_FOLDER'], 'messages')
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'pdf', 'doc', 'docx'}

# Ensure upload folders exist
os.makedirs(app.config['PROFILE_PICS_FOLDER'], exist_ok=True)
os.makedirs(app.config['MESSAGES_FOLDER'], exist_ok=True)

# Initialize Flask-SQLAlchemy
db = SQLAlchemy(app)

# Initialize Flask-Migrate
migrate = Migrate(app, db)

# Initialize Flask-SocketIO with explicit transport configuration
socketio = SocketIO(app, cors_allowed_origins="*", allow_transports=['polling', 'websocket'])

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# AES Encryption Key (32 bytes for AES-256)
AES_KEY = get_random_bytes(32)  # Generate a random 32-byte key for AES-256

# User model for database
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(120), nullable=False)
    profile_pic = db.Column(db.String(120), nullable=True)
    last_seen = db.Column(db.DateTime, nullable=True)
    is_online = db.Column(db.Boolean, default=False)
    public_username = db.Column(db.String(80), unique=True, nullable=True)  # Telegram-like username

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# ChatHistory model for AI chat history
class ChatHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    chat_name = db.Column(db.String(100), nullable=False)
    user_message = db.Column(db.Text, nullable=False)
    bot_reply = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)

# Group model
class Group(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)
    is_channel = db.Column(db.Boolean, default=False)  # For Telegram-like channels

# GroupMember model (to track group members)
class GroupMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)

# Message model for messaging app (1:1 and group chats)
class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # For 1:1 chats
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=True)  # For group chats
    content = db.Column(db.Text, nullable=True)  # Encrypted text content
    content_type = db.Column(db.String(20), nullable=False, default='text')  # text, image, video, file
    file_path = db.Column(db.String(200), nullable=True)  # Path to media/file
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)
    is_secret = db.Column(db.Boolean, default=False)  # For Telegram-like secret chats
    disappear_timer = db.Column(db.Integer, nullable=True)  # Signal-like disappearing messages (in seconds)
    edited = db.Column(db.Boolean, default=False)  # For Telegram-like edit feature

# Status model for WhatsApp-like status feature
class Status(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.String(200), nullable=True)  # Text or file path
    content_type = db.Column(db.String(20), nullable=False, default='text')  # text, image, video
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)

# Create database tables and add a default user
with app.app_context():
    db.create_all()
    # Add a default user if not exists
    default_user = User.query.filter_by(username='testuser').first()
    if not default_user:
        default_user = User(username='testuser', email='testuser@example.com', public_username='testuser_public')
        default_user.set_password('testpassword')
        db.session.add(default_user)
        db.session.commit()
        print("Default user 'testuser' created with password 'testpassword'")

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Utility functions
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

# AES Encryption and Decryption
def encrypt_message(message):
    try:
        # Pad the message to be a multiple of 16 bytes
        message = message.encode('utf-8')
        pad_length = 16 - (len(message) % 16)
        message += bytes([pad_length] * pad_length)

        # Generate a random IV (Initialization Vector)
        iv = get_random_bytes(16)
        cipher = AES.new(AES_KEY, AES.MODE_CBC, iv)

        # Encrypt the message
        encrypted = cipher.encrypt(message)
        # Combine IV and encrypted message, then encode to base64
        encrypted_message = base64.b64encode(iv + encrypted).decode('utf-8')
        logger.info(f"Encrypted message: {message} -> {encrypted_message}")
        return encrypted_message
    except Exception as e:
        logger.error(f"Error encrypting message: {str(e)}")
        traceback.print_exc()
        raise e

def decrypt_message(encrypted_message):
    try:
        # Decode from base64
        encrypted = base64.b64decode(encrypted_message.encode('utf-8'))
        # Extract IV and encrypted message
        iv = encrypted[:16]
        encrypted = encrypted[16:]

        # Decrypt the message
        cipher = AES.new(AES_KEY, AES.MODE_CBC, iv)
        decrypted = cipher.decrypt(encrypted)

        # Remove padding
        pad_length = decrypted[-1]
        decrypted = decrypted[:-pad_length].decode('utf-8')
        logger.info(f"Decrypted message: {encrypted_message} -> {decrypted}")
        return decrypted
    except Exception as e:
        logger.error(f"Error decrypting message: {str(e)}")
        traceback.print_exc()
        return "Error decrypting message"

# Function to clean LaTeX formatting and convert to plain text (for AI chat)
def clean_latex(text):
    text = re.sub(r'\\boxed\{(.*?)\}', r'\1', text)
    text = re.sub(r'\\[\[\(](.*?)\\[\]\)]', r'\1', text)
    text = re.sub(r'\\[a-zA-Z]+', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# Function to map model name to OpenRouter model (for AI chat)
def map_model_to_openrouter(model_name):
    model_map = {
        'ChatGPT': 'openai/gpt-4.1-nano',
        'Grok': 'x-ai/grok-3-mini-beta',
        'DeepSeek': 'perplexity/llama-3.1-sonar-small-128k-online',
        'Claude': 'anthropic/claude-3.5-haiku',
        'MetaAI': 'meta-llama/llama-4-maverick:free',
        'Gemini': 'google/gemini-2.5-flash-lite-preview-06-17'
    }
    return model_map.get(model_name, 'x-ai/grok-3-mini-beta')

# Function to generate chat name based on user's first message (for AI chat)
def generate_chat_name(message):
    words = message.split()[:5]
    chat_name = ' '.join(words).capitalize()
    chat_name = re.sub(r'[^a-zA-Z0-9\s]', '', chat_name)
    if not chat_name.strip():
        chat_name = "Untitled Chat"
    return chat_name

# Function to send email (used for verification code, username, and password reset)
def send_email(to_email, subject, body):
    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_SENDER
        msg['To'] = to_email
        msg['Subject'] = subject

        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP('smtp.privateemail.com', 587)
        server.starttls()
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(EMAIL_SENDER, to_email, text)
        server.quit()
        logger.info(f"Email sent to {to_email}")
    except Exception as e:
        logger.error(f"Error sending email: {str(e)}")
        raise

@app.route('/')
def index():
    print("Rendering index.html for home page")
    return render_template('index.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        step = request.form.get('step', 'email')

        if step == 'email':
            email = request.form['email']
            if User.query.filter_by(email=email).first():
                flash('Email already registered! Try a different one.', 'error')
                return redirect(url_for('register'))

            code = str(random.randint(100000, 999999))
            session['verification_code'] = code
            session['email'] = email

            try:
                send_email(email, 'ChatGod Email Verification Code', 
                           f'Your verification code is: {code}\nPlease enter this code to verify your email.')
                flash('Verification code sent to your email!', 'success')
                return render_template('register.html', step='verify')
            except Exception as e:
                flash(f'Error sending verification code: {str(e)}', 'error')
                return redirect(url_for('register'))

        elif step == 'verify':
            code = request.form['code']
            if code == session.get('verification_code'):
                flash('Email verified successfully! Set your password.', 'success')
                return render_template('register.html', step='password')
            else:
                flash('Invalid verification code!', 'error')
                return render_template('register.html', step='verify')

        elif step == 'password':
            username = request.form['username']
            public_username = request.form['public_username']
            password = request.form['password']
            email = session.get('email')

            if User.query.filter_by(username=username).first():
                flash('Username already exists! Try a different one.', 'error')
                return render_template('register.html', step='password')

            if public_username and User.query.filter_by(public_username=public_username).first():
                flash('Public username already exists! Try a different one.', 'error')
                return render_template('register.html', step='password')

            user = User(username=username, email=email, public_username=public_username)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            flash('Registration successful! Please log in.', 'success')
            return redirect(url_for('login'))

    return render_template('register.html', step='email')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        step = request.form.get('step', 'login')

        if step == 'login':
            username = request.form['username']
            password = request.form['password']
            print(f"Login attempt with username: {username}, password: {password}")
            user = User.query.filter_by(username=username).first()
            
            if user:
                print(f"User found: {user.username}")
            else:
                print("User not found!")
            if user and user.check_password(password):
                login_user(user)
                user.is_online = True
                user.last_seen = datetime.datetime.utcnow()
                db.session.commit()
                print(f"User {username} logged in successfully!")
                flash('Logged in successfully!', 'success')
                return redirect(url_for('index'))
            else:
                print("Invalid credentials!")
                flash('Invalid username or password.', 'error')
                return redirect(url_for('login'))
        
        elif step == 'forgot_username':
            email = request.form['email']
            user = User.query.filter_by(email=email).first()
            
            if user:
                try:
                    send_email(email, 'ChatGod - Your Username', 
                               f'Your username is: {user.username}\nYou can now log in with this username.')
                    flash('Username sent to your email!', 'success')
                except Exception as e:
                    flash(f'Error sending username: {str(e)}', 'error')
            else:
                flash('Email not found. Please register first.', 'error')
            return redirect(url_for('login'))
        
        elif step == 'forgot_password':
            username = request.form['username']
            email = request.form['email']
            user = User.query.filter_by(username=username, email=email).first()
            
            if user:
                code = str(random.randint(100000, 999999))
                session['reset_code'] = code
                session['reset_user_id'] = user.id
                
                try:
                    send_email(email, 'ChatGod - Password Reset Verification Code', 
                               f'Your password reset verification code is: {code}\nPlease enter this code to reset your password.')
                    flash('Verification code sent to your email!', 'success')
                    return render_template('login.html', step='reset_password')
                except Exception as e:
                    flash(f'Error sending verification code: {str(e)}', 'error')
            else:
                flash('Username or email not found.', 'error')
            return redirect(url_for('login'))
        
        elif step == 'reset_password':
            code = request.form['code']
            new_password = request.form['new_password']
            
            if code == session.get('reset_code'):
                user = User.query.get(session.get('reset_user_id'))
                if user:
                    user.set_password(new_password)
                    db.session.commit()
                    session.pop('reset_code', None)
                    session.pop('reset_user_id', None)
                    flash('Password reset successfully! Please log in.', 'success')
                else:
                    flash('User not found.', 'error')
            else:
                flash('Invalid verification code!', 'error')
                return render_template('login.html', step='reset_password')
            return redirect(url_for('login'))

    step = request.args.get('step', 'login')
    return render_template('login.html', step=step)

@app.route('/logout')
@login_required
def logout():
    current_user.is_online = False
    current_user.last_seen = datetime.datetime.utcnow()
    db.session.commit()
    logout_user()
    flash('Logged out successfully!', 'success')
    return redirect(url_for('index'))

# AI Chat Routes
@app.route('/ai_chat')
@login_required
def ai_chat():
    logger.info("Serving AI chat page")
    if 'current_chat_name' not in session:
        session['current_chat_name'] = f"Chat_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        session['reset_history'] = True
        session['current_model'] = 'DeepSeek'
        logger.info(f"New chat name set: {session['current_chat_name']}")
    return render_template('ai_chat.html', chat_name=session['current_chat_name'])

@app.route('/start_new_chat/<chat_name>', methods=['GET'])
@login_required
def start_new_chat(chat_name):
    try:
        logger.info(f"Starting new chat for user {current_user.id} with chat name {chat_name}")
        session['current_chat_name'] = chat_name
        session['reset_history'] = True
        logger.info("New chat started successfully with history reset")
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        logger.error(f"Error starting new chat: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/delete_history', methods=['POST'])
@login_required
def delete_history():
    try:
        logger.info(f"Deleting chat history for user {current_user.id}")
        ChatHistory.query.filter_by(user_id=current_user.id).delete()
        db.session.commit()
        session.pop('current_chat_name', None)
        session.pop('reset_history', None)
        session.pop('current_model', None)
        logger.info("Chat history deleted successfully")
        flash('Chat history deleted successfully!', 'success')
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        logger.error(f"Error deleting chat history: {str(e)}")
        flash('Error deleting chat history!', 'error')
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/get_chat_history', methods=['GET'])
@login_required
def get_chat_history():
    try:
        logger.info(f"Fetching chat history for user {current_user.id}")
        chats = db.session.query(ChatHistory.chat_name).filter_by(user_id=current_user.id).distinct().all()
        chat_names = [chat[0] for chat in chats]
        logger.info(f"Chat names fetched: {chat_names}")
        return jsonify({'chat_names': chat_names})
    except Exception as e:
        logger.error(f"Error fetching chat history: {str(e)}")
        return jsonify({'error': 'Error fetching chat history'}), 500

@app.route('/load_chat/<chat_name>', methods=['GET'])
@login_required
def load_chat(chat_name):
    try:
        logger.info(f"Loading chat {chat_name} for user {current_user.id}")
        chat_history = ChatHistory.query.filter_by(user_id=current_user.id, chat_name=chat_name).order_by(ChatHistory.timestamp.asc()).all()
        history = [{'user': chat.user_message, 'bot': chat.bot_reply} for chat in chat_history]
        session['current_chat_name'] = chat_name
        session['reset_history'] = False
        logger.info(f"Chat history loaded: {history}")
        return jsonify({'history': history})
    except Exception as e:
        logger.error(f"Error loading chat: {str(e)}")
        return jsonify({'error': 'Error loading chat'}), 500

@app.route('/ask', methods=['POST'])
@login_required
def ask():
    try:
        logger.info("Received request at /ask endpoint")
        data = request.get_json()
        if data is None:
            logger.error("No JSON data found in request")
            return jsonify({'reply': "Bhai, kuch toh galat hai! JSON data nahi mila. 😅"}), 400

        user_message = data.get('message')
        mode = data.get('mode', 'Normal')
        models = data.get('models', ['Grok'])

        logger.debug(f"User message: {user_message}")
        logger.debug(f"Mode: {mode}")
        logger.debug(f"Models received: {models}")

        if not user_message:
            logger.error("No message provided in request")
            return jsonify({'reply': "Bhai, message toh daal de! 😅"}), 400

        if not models or not isinstance(models, list):
            raise ValueError("Models must be a non-empty list")

        current_model = session.get('current_model', 'DeepSeek')
        new_model = models[0]
        if current_model != new_model:
            session['current_model'] = new_model
            session['reset_history'] = True
            logger.info(f"Model switched to {new_model}, resetting history")

        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://x07.in",
            "X-Title": "ChatGod"
        }
        logger.debug(f"Headers: {headers}")

        history_context = ""
        if not session.get('reset_history', False):
            current_chat_name = session.get('current_chat_name')
            if current_chat_name:
                chat_history = ChatHistory.query.filter_by(
                    user_id=current_user.id,
                    chat_name=current_chat_name
                ).order_by(ChatHistory.timestamp.asc()).all()
                for chat in chat_history:
                    history_context += f"User: {chat.user_message}\nBot: {chat.bot_reply}\n"
        else:
            session['reset_history'] = False
            logger.info("History reset for new chat or model switch")

        current_chat_name = session.get('current_chat_name', f"Chat_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}")
        chat_exists = ChatHistory.query.filter_by(user_id=current_user.id, chat_name=current_chat_name).first()

        if not chat_exists and current_chat_name.startswith("Chat_"):
            new_chat_name = generate_chat_name(user_message)
            existing_chat = ChatHistory.query.filter_by(user_id=current_user.id, chat_name=new_chat_name).first()
            if existing_chat:
                timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
                new_chat_name = f"{new_chat_name}_{timestamp}"
            session['current_chat_name'] = new_chat_name
            current_chat_name = new_chat_name
            logger.info(f"Updated chat name to: {current_chat_name}")

        base_instructions = (
            "Answer in a casual, conversational tone using simple language and Hindi slang like 'bhai', 'laude', 'dhang se', etc. "
            "Use Markdown formatting for better readability:\n"
            "- Use ## for headings\n"
            "- Use **bold** for emphasis\n"
            "- Use *italic* for subtle emphasis\n"
            "- Use - for bullet points\n"
            "- Use ```code``` for code blocks\n"
            "Break your answers into small paragraphs for easy reading. "
            "Add emojis to make it fun 😎🚀. "
            "Keep replies engaging, like you're talking to a friend. "
            "Here is the user's chat history to provide context:\n" + history_context
        )

        model_instructions = {
            'ChatGPT': "Act like a witty and knowledgeable friend who explains things with a bit of humor. Use a cheerful tone! 😄",
            'Grok': "Act like a cool, desi bhai who gives straightforward and practical advice with a touch of sarcasm. 😎",
            'DeepSeek': "Act like a curious and enthusiastic friend who loves digging deep into topics. Keep it exciting! 🤓",
            'Claude': "Act like a wise and patient friend who explains things calmly but with a fun twist. 🧘‍♂️",
            'MetaAI': "Act like a tech-savvy friend who loves breaking down complex stuff into simple bits. Use a confident tone! 💪",
            'Gemini': "Act like a playful and energetic friend who makes learning fun with lots of excitement. 🎉"
        }

        custom_instructions = {
            'Normal': (
                "You are ChatGod, a friendly and witty AI with a desi vibe. "
                "Focus on giving simple and fun answers with a casual tone. "
                "Here is the user's chat history to provide context:\n" + history_context
            ),
            'Pro': (
                "You are ChatGod, a knowledgeable AI who gives detailed and accurate answers. "
                "Focus on explaining things thoroughly but keep it simple,no abusive bad words and engaging. "
                "Here is the user's chat history to provide context:\n" + history_context
            ),
            'Fun': (
                "You are ChatGod, a dark-humored AI who roasts and uses gandi-gandi gaali in answers. "
                "Keep it max 4-5 lines, use lots of roasting, and add emojis for fun. "
                "Here is the user's chat history to provide context:\n" + history_context
            )
        }

        bot_reply = ""
        for i, model in enumerate(models):
            mapped_model = map_model_to_openrouter(model)
            logger.debug(f"Using model: {mapped_model} (original: {model})")

            mode_instruction = custom_instructions.get(mode, custom_instructions['Normal'])
            model_tone = model_instructions.get(model, "Act like a friendly and witty AI with a desi vibe. 😎")
            system_prompt = (
                f"{mode_instruction}\n"
                f"{model_tone}\n"
                f"{base_instructions}"
            )

            data = {
                "model": mapped_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                "temperature": 0.7,
                "max_tokens": 500
            }
            logger.debug(f"Request data for model {mapped_model}: {data}")

            logger.debug(f"Sending request to OpenRouter API for model {mapped_model}")
            response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data)
            logger.debug(f"Response status for model {mapped_model}: {response.status_code}")
            logger.debug(f"Raw response for model {mapped_model}: {response.text}")

            if response.status_code != 200:
                logger.warning(f"Model {mapped_model} failed with status {response.status_code}, falling back to xai/grok")
                data['model'] = 'xai/grok'
                response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data)
                logger.debug(f"Fallback response status: {response.status_code}")
                logger.debug(f"Fallback raw response: {response.text}")
                if response.status_code != 200:
                    raise requests.exceptions.RequestException(f"Fallback request failed with status {response.status_code}: {response.text}")

            result = response.json()
            logger.debug(f"OpenRouter API response for model {mapped_model}: {result}")

            if 'choices' not in result or not result['choices']:
                raise ValueError("No choices in API response")

            model_reply = result['choices'][0]['message']['content']
            model_reply = clean_latex(model_reply)
            bot_reply += model_reply + "\n"

        chat_entry = ChatHistory(
            user_id=current_user.id,
            chat_name=current_chat_name,
            user_message=user_message,
            bot_reply=bot_reply.strip()
        )
        db.session.add(chat_entry)
        db.session.commit()

        logger.info("Successfully got bot reply")
        return jsonify({'reply': bot_reply.strip()})
    except Exception as e:
        logger.error(f"Error in /ask endpoint: {str(e)}")
        return jsonify({'reply': f"Bhosdike, kuch galat ho gaya! 😅 Error: {str(e)}"}), 500

# Messaging App Routes
@app.route('/messaging', methods=['GET', 'POST'])
@login_required
def messaging():
    users = User.query.filter(User.id != current_user.id).all()
    groups = Group.query.join(GroupMember, GroupMember.group_id == Group.id).filter(GroupMember.user_id == current_user.id).all()
    selected_user_id = request.args.get('user_id')
    selected_group_id = request.args.get('group_id')
    messages = []
    selected_user = None
    selected_group = None
    chat_type = request.args.get('chat_type', 'user')

    # Convert users to JSON-serializable format
    users_list = [
        {
            'id': user.id,
            'username': user.username,
            'profile_pic': user.profile_pic
        } for user in users
    ]

    # Convert groups to JSON-serializable format
    groups_list = [
        {
            'id': group.id,
            'name': group.name,
            'is_channel': group.is_channel
        } for group in groups
    ]

    print(f"Fetching messaging data for user {current_user.id}")
    print(f"Users: {[u['username'] for u in users_list]}")
    print(f"Groups: {[g['name'] for g in groups_list]}")

    if selected_user_id:
        selected_user = User.query.get(selected_user_id)
        if selected_user:
            print(f"Selected user: {selected_user.username}")
            messages = Message.query.filter(
                ((Message.sender_id == current_user.id) & (Message.receiver_id == selected_user.id)) |
                ((Message.sender_id == selected_user.id) & (Message.receiver_id == current_user.id))
            ).filter_by(group_id=None).order_by(Message.timestamp.asc()).all()
            for message in messages:
                if message.content and message.content_type == 'text':
                    try:
                        message.content = decrypt_message(message.content)
                    except Exception as e:
                        print(f"Error decrypting message {message.id}: {str(e)}")
                        message.content = "Error decrypting message"
            for message in messages:
                if message.sender_id == selected_user.id and not message.is_read:
                    message.is_read = True
            db.session.commit()
            chat_type = 'user'
            print(f"Messages fetched for user {selected_user_id}: {len(messages)} messages")

    elif selected_group_id:
        selected_group = Group.query.get(selected_group_id)
        if selected_group:
            print(f"Selected group: {selected_group.name}")
            messages = Message.query.filter_by(group_id=selected_group_id).order_by(Message.timestamp.asc()).all()
            for message in messages:
                if message.content and message.content_type == 'text':
                    try:
                        message.content = decrypt_message(message.content)
                    except Exception as e:
                        print(f"Error decrypting message {message.id}: {str(e)}")
                        message.content = "Error decrypting message"
            chat_type = 'group'
            print(f"Messages fetched for group {selected_group_id}: {len(messages)} messages")

    print("Rendering messaging.html")
    return render_template('messaging.html', users=users, users_list=users_list, groups=groups, groups_list=groups_list, messages=messages, 
                           selected_user=selected_user, selected_group=selected_group, chat_type=chat_type)

@app.route('/create_group', methods=['GET', 'POST'])
@login_required
def create_group():
    if request.method == 'POST':
        group_name = request.form['group_name']
        member_ids = request.form.getlist('members')
        is_channel = 'is_channel' in request.form  # Telegram-like channel

        group = Group(name=group_name, creator_id=current_user.id, is_channel=is_channel)
        db.session.add(group)
        db.session.commit()

        creator_member = GroupMember(group_id=group.id, user_id=current_user.id, is_admin=True)
        db.session.add(creator_member)

        for member_id in member_ids:
            member = GroupMember(group_id=group.id, user_id=member_id)
            db.session.add(member)

        db.session.commit()
        flash('Group created successfully!', 'success')
        return redirect(url_for('messaging', group_id=group.id, chat_type='group'))

    users = User.query.filter(User.id != current_user.id).all()
    return render_template('group_create.html', users=users)

@app.route('/status', methods=['GET', 'POST'])
@login_required
def status():
    if request.method == 'POST':
        content = request.form.get('content')
        content_type = 'text'
        file_path = None

        if 'file' in request.files:
            file = request.files['file']
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                file_path = os.path.join(app.config['MESSAGES_FOLDER'], f"status_{current_user.id}_{filename}")
                file.save(file_path)
                content_type = 'image' if file.mimetype.startswith('image') else 'video'

        status = Status(user_id=current_user.id, content=content, content_type=content_type, file_path=file_path)
        db.session.add(status)
        db.session.commit()
        flash('Status updated!', 'success')
        return redirect(url_for('status'))

    statuses = Status.query.all()
    return render_template('status.html', statuses=statuses)

@app.route('/edit_message/<int:message_id>', methods=['POST'])
@login_required
def edit_message(message_id):
    message = Message.query.get_or_404(message_id)
    if message.sender_id != current_user.id:
        return jsonify({'error': 'You can only edit your own messages!'}), 403

    new_content = request.form.get('content')
    encrypted_content = encrypt_message(new_content) if new_content else None
    message.content = encrypted_content
    message.edited = True
    db.session.commit()

    decrypted_content = decrypt_message(encrypted_content) if encrypted_content else new_content
    room = f"chat_{min(current_user.id, message.receiver_id)}_{max(current_user.id, message.receiver_id)}" if message.receiver_id else f"group_{message.group_id}"
    emit('message_edited', {
        'message_id': message.id,
        'content': decrypted_content,
        'edited': True
    }, room=room, broadcast=True)

    return jsonify({'message': 'Message edited successfully!'})

@app.route('/set_disappear_timer/<int:message_id>', methods=['POST'])
@login_required
def set_disappear_timer(message_id):
    message = Message.query.get_or_404(message_id)
    if message.sender_id != current_user.id:
        return jsonify({'error': 'You can only set timers for your own messages!'}), 403

    timer = int(request.form.get('timer', 0))
    message.disappear_timer = timer
    db.session.commit()

    room = f"chat_{min(current_user.id, message.receiver_id)}_{max(current_user.id, message.receiver_id)}" if message.receiver_id else f"group_{message.group_id}"
    emit('disappear_timer_set', {
        'message_id': message.id,
        'timer': timer
    }, room=room, broadcast=True)

    return jsonify({'message': 'Disappear timer set successfully!'})

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        if 'profile_pic' in request.files:
            file = request.files['profile_pic']
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                user_id = str(current_user.id)
                ext = filename.rsplit('.', 1)[1].lower()
                new_filename = f"{user_id}.{ext}"
                file_path = os.path.join(app.config['PROFILE_PICS_FOLDER'], new_filename)
                
                img = Image.open(file)
                img = img.resize((150, 150), Image.LANCZOS)
                img.save(file_path)

                current_user.profile_pic = new_filename
                db.session.commit()
                flash('Profile picture updated!', 'success')
            else:
                flash('Invalid file format!', 'error')
        return redirect(url_for('profile'))

    return render_template('profile.html', user=current_user)

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# SocketIO events for messaging
@socketio.on('connect')
def handle_connect():
    if current_user.is_authenticated:
        current_user.is_online = True
        current_user.last_seen = datetime.datetime.utcnow()
        db.session.commit()
        emit('user_status', {'user_id': current_user.id, 'status': 'online'}, broadcast=True)
        logger.info(f"User {current_user.id} connected with Socket.IO")
    print("Client connected!")

@socketio.on('disconnect')
def handle_disconnect():
    if current_user.is_authenticated:
        current_user.is_online = False
        current_user.last_seen = datetime.datetime.utcnow()
        db.session.commit()
        emit('user_status', {'user_id': current_user.id, 'status': 'offline', 'last_seen': current_user.last_seen.strftime('%Y-%m-%d %H:%M:%S')}, broadcast=True)
        logger.info(f"User {current_user.id} disconnected from Socket.IO")
    print("Client disconnected!")

@socketio.on('connect_error')
def handle_connect_error(error):
    logger.error(f"Socket.IO connect error: {str(error)}")
    print(f"Socket.IO connect error: {str(error)}")

@socketio.on('join')
def on_join(data):
    room = data['room']
    join_room(room)
    logger.info(f"User {current_user.id} joined room {room}")

@socketio.on('leave')
def on_leave(data):
    room = data['room']
    leave_room(room)
    logger.info(f"User {current_user.id} left room {room}")

@socketio.on('typing')
def handle_typing(data):
    room = data['room']
    emit('typing', {'user_id': current_user.id, 'username': current_user.username}, room=room, broadcast=True)

@socketio.on('stop_typing')
def handle_stop_typing(data):
    room = data['room']
    emit('stop_typing', {'user_id': current_user.id}, room=room, broadcast=True)

@socketio.on('send_message')
def handle_send_message(data):
    receiver_id = data.get('receiver_id')
    group_id = data.get('group_id')
    content = data.get('content')
    content_type = data.get('content_type', 'text')
    file_path = data.get('file_path')
    is_secret = data.get('is_secret', False)
    disappear_timer = data.get('disappear_timer', None)

    encrypted_content = encrypt_message(content) if content_type == 'text' and content else None

    message = Message(
        sender_id=current_user.id,
        receiver_id=receiver_id if receiver_id else None,
        group_id=group_id if group_id else None,
        content=encrypted_content,
        content_type=content_type,
        file_path=file_path,
        is_secret=is_secret,
        disappear_timer=disappear_timer
    )
    db.session.add(message)
    db.session.commit()

    decrypted_content = decrypt_message(encrypted_content) if encrypted_content else content

    if group_id:
        room = f"group_{group_id}"
        emit('receive_message', {
            'sender_id': current_user.id,
            'sender_username': current_user.username,
            'content': decrypted_content,
            'content_type': content_type,
            'file_path': file_path,
            'timestamp': message.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'message_id': message.id,
            'is_secret': is_secret,
            'disappear_timer': disappear_timer
        }, room=room, broadcast=True)
    else:
        room = f"chat_{min(current_user.id, receiver_id)}_{max(current_user.id, receiver_id)}"
        emit('receive_message', {
            'sender_id': current_user.id,
            'sender_username': current_user.username,
            'content': decrypted_content,
            'content_type': content_type,
            'file_path': file_path,
            'timestamp': message.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'message_id': message.id,
            'is_secret': is_secret,
            'disappear_timer': disappear_timer
        }, room=room, broadcast=True)

@socketio.on('message_read')
def handle_message_read(data):
    message_id = data['message_id']
    message = Message.query.get(message_id)
    if message and message.sender_id != current_user.id and not message.is_read:
        message.is_read = True
        db.session.commit()
        room = f"chat_{min(current_user.id, message.sender_id)}_{max(current_user.id, message.sender_id)}"
        emit('message_read', {'message_id': message_id}, room=room, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
