from flask import Flask, request, jsonify, render_template, redirect, url_for, flash, session
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import requests
from dotenv import load_dotenv
import os
import logging
import re
import smtplib
import random
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import datetime

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

# Initialize Flask-SQLAlchemy
db = SQLAlchemy(app)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# User model for database
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# ChatHistory model for storing user-specific chat history
class ChatHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    chat_name = db.Column(db.String(100), nullable=False)
    user_message = db.Column(db.Text, nullable=False)
    bot_reply = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)

# Create database tables
with app.app_context():
    db.create_all()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Function to clean LaTeX formatting and convert to plain text
def clean_latex(text):
    text = re.sub(r'\\boxed\{(.*?)\}', r'\1', text)
    text = re.sub(r'\\[\[\(](.*?)\\[\]\)]', r'\1', text)
    text = re.sub(r'\\[a-zA-Z]+', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# Function to map model name to OpenRouter model
def map_model_to_openrouter(model_name):
    model_map = {
        'ChatGPT': 'openai/gpt-4.1-nano',
        'Grok': 'x-ai/grok-3-mini-beta',
        'DeepSeek': 'deepseek/deepseek-chat-v3-0324:free',
        'Claude': 'anthropic/claude-3.5-haiku',
        'MetaAI': 'meta-llama/llama-4-maverick:free',
        'Gemini': 'google/gemini-2.5-flash-preview'
    }
    return model_map.get(model_name, 'x-ai/grok-3-mini-beta')  # Default to Grok if model not found

# Function to generate chat name based on user's first message
def generate_chat_name(message):
    # Take the first 5 words of the message (or less if message is shorter)
    words = message.split()[:5]
    chat_name = ' '.join(words).capitalize()
    # Remove any special characters and keep it clean
    chat_name = re.sub(r'[^a-zA-Z0-9\s]', '', chat_name)
    # If chat name is empty, use a default name
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
def home():
    logger.info("Serving home page")
    if current_user.is_authenticated:
        return redirect(url_for('chat'))
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
            password = request.form['password']
            email = session.get('email')

            if User.query.filter_by(username=username).first():
                flash('Username already exists! Try a different one.', 'error')
                return render_template('register.html', step='password')

            user = User(username=username, email=email)
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
            user = User.query.filter_by(username=username).first()
            
            if user and user.check_password(password):
                login_user(user)
                flash('Logged in successfully!', 'success')
                return redirect(url_for('chat'))
            else:
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
    logout_user()
    flash('Logged out successfully!', 'success')
    return redirect(url_for('home'))

@app.route('/chat')
@login_required
def chat():
    logger.info("Serving chat page")
    # Generate a new chat name if not already in session
    if 'current_chat_name' not in session:
        # Set new chat name
        session['current_chat_name'] = f"Chat_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        logger.info(f"New chat name set: {session['current_chat_name']}")
    return render_template('chat.html', chat_name=session['current_chat_name'])

@app.route('/start_new_chat/<chat_name>', methods=['GET'])
@login_required
def start_new_chat(chat_name):
    try:
        logger.info(f"Starting new chat for user {current_user.id} with chat name {chat_name}")
        # Simply set the new chat name in the session, do not delete history
        session['current_chat_name'] = chat_name
        logger.info("New chat started successfully")
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        logger.error(f"Error starting new chat: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/delete_history', methods=['POST'])
@login_required
def delete_history():
    try:
        logger.info(f"Deleting chat history for user {current_user.id}")
        # Delete all chat history for the current user
        ChatHistory.query.filter_by(user_id=current_user.id).delete()
        db.session.commit()
        # Clear session chat name to start a new chat
        session.pop('current_chat_name', None)
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
        # Group chat history by chat_name
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
        # Load chat history for the given chat_name
        chat_history = ChatHistory.query.filter_by(user_id=current_user.id, chat_name=chat_name).order_by(ChatHistory.timestamp.asc()).all()
        history = [{'user': chat.user_message, 'bot': chat.bot_reply} for chat in chat_history]
        session['current_chat_name'] = chat_name  # Update current chat name
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
        user_message = data.get('message')
        mode = data.get('mode', 'Normal')
        models = data.get('models', ['Grok'])

        logger.debug(f"User message: {user_message}")
        logger.debug(f"Mode: {mode}")
        logger.debug(f"Models received: {models}")

        # Validate models list
        if not models or not isinstance(models, list):
            raise ValueError("Models must be a non-empty list")

        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://x07.in",
            "X-Title": "ChatGod"
        }
        logger.debug(f"Headers: {headers}")

        # Load user-specific chat history to provide context
        chat_history = ChatHistory.query.filter_by(user_id=current_user.id).order_by(ChatHistory.timestamp.asc()).all()
        history_context = ""
        for chat in chat_history:
            history_context += f"User: {chat.user_message}\nBot: {chat.bot_reply}\n"

        # Check if this is the first message in the current chat
        current_chat_name = session.get('current_chat_name', f"Chat_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}")
        chat_exists = ChatHistory.query.filter_by(user_id=current_user.id, chat_name=current_chat_name).first()

        # If no messages exist for this chat, update the chat name based on the user's message
        if not chat_exists and current_chat_name.startswith("Chat_"):
            new_chat_name = generate_chat_name(user_message)
            # Ensure the new chat name is unique
            existing_chat = ChatHistory.query.filter_by(user_id=current_user.id, chat_name=new_chat_name).first()
            if existing_chat:
                # If the chat name already exists, append a timestamp to make it unique
                timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
                new_chat_name = f"{new_chat_name}_{timestamp}"
            session['current_chat_name'] = new_chat_name
            current_chat_name = new_chat_name
            logger.info(f"Updated chat name to: {current_chat_name}")

        # Define base styling instructions for all modes and models
        base_instructions = (
            "Answer in a casual, conversational tone using simple language and Hindi slang like 'bhai', 'laude', 'dhang se', etc. "
            "Break your answers into small paragraphs for easy reading. "
            "Use **bold** and *italics* for emphasis, and add emojis to make it fun 😎🚀. "
            "Keep replies engaging, like you're talking to a friend. "
            "Here is the user's chat history to provide context:\n" + history_context
        )

        # Define model-specific tones while keeping the styling consistent
        model_instructions = {
            'ChatGPT': "Act like a witty and knowledgeable friend who explains things with a bit of humor. Use a cheerful tone! 😄",
            'Grok': "Act like a cool, desi bhai who gives straightforward and practical advice with a touch of sarcasm. 😎",
            'DeepSeek': "Act like a curious and enthusiastic friend who loves digging deep into topics. Keep it exciting! 🤓",
            'Claude': "Act like a wise and patient friend who explains things calmly but with a fun twist. 🧘‍♂️",
            'MetaAI': "Act like a tech-savvy friend who loves breaking down complex stuff into simple bits. Use a confident tone! 💪",
            'Gemini': "Act like a playful and energetic friend who makes learning fun with lots of excitement. 🎉"
        }

        # Define mode-specific instructions
        custom_instructions = {
            'Normal': (
                "You are ChatGod, a friendly and witty AI with a desi vibe. "
                "Focus on giving simple and fun answers with a casual tone. "
                "Here is the user's chat history to provide context:\n" + history_context
            ),
            'Pro': (
                "You are ChatGod, a knowledgeable AI who gives detailed and accurate answers. "
                "Focus on explaining things thoroughly but keep it simple and engaging. "
                "Here is the user's chat history to provide context:\n" + history_context
            ),
            'Fun': (
                "You are ChatGod, a dark-humored AI who roasts and uses gandi-gandi gaali in answers. "
                "Keep it max 4 lines, use lots of roasting, and add emojis for fun. "
                "Here is the user's chat history to provide context:\n" + history_context
            )
        }

        bot_reply = ""
        for i, model in enumerate(models):
            # Map the model name to OpenRouter model
            mapped_model = map_model_to_openrouter(model)
            logger.debug(f"Using model: {mapped_model} (original: {model})")

            # Combine mode instructions with model-specific tone and base styling
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

            # Make the API call
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

        # Save chat to history
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
