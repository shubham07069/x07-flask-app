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

# Function to send verification code to email using Private Email SMTP
def send_verification_email(email, code):
    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_SENDER  # e.g., noreply@x07.in
        msg['To'] = email
        msg['Subject'] = 'ChatGod Email Verification Code'

        body = f'Your verification code is: {code}\nPlease enter this code to verify your email.'
        msg.attach(MIMEText(body, 'plain'))

        # Use Private Email SMTP settings
        server = smtplib.SMTP('smtp.privateemail.com', 587)
        server.starttls()
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(EMAIL_SENDER, email, text)
        server.quit()
        logger.info(f"Verification code sent to {email}")
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
        step = request.form.get('step', 'email')  # Track the registration step

        if step == 'email':
            email = request.form['email']
            if User.query.filter_by(email=email).first():
                flash('Email already registered! Try a different one.', 'error')
                return redirect(url_for('register'))

            # Generate a 6-digit verification code
            code = str(random.randint(100000, 999999))
            session['verification_code'] = code
            session['email'] = email

            # Send verification code to email
            try:
                send_verification_email(email, code)
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
    
    return render_template('login.html')

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
    return render_template('chat.html')

@app.route('/ask', methods=['POST'])
@login_required
def ask():
    try:
        logger.info("Received request at /ask endpoint")
        data = request.get_json()
        user_message = data.get('message')
        mode = data.get('mode', 'Normal')
        models = data.get('models', ['deepseek/deepseek-chat'])

        logger.debug(f"User message: {user_message}")
        logger.debug(f"Mode: {mode}")
        logger.debug(f"Models: {models}")

        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://x07.in",
            "X-Title": "ChatGod"
        }
        logger.debug(f"Headers: {headers}")

        # Define custom instructions based on mode
        custom_instructions = {
            'Normal': (
                "You are ChatGod, a friendly and witty AI with a desi vibe. "
                "Answer in a casual, conversational tone using Hindi slang like 'bhai', 'laude', 'dhang se', etc., "
                "and add some humor with emojis 😎🚀. Avoid formal language and LaTeX formatting. "
                "Keep replies simple, fun, and engaging, like you're talking to a friend."
            ),
            'Pro': "Yeh bahut powerful AI hai.",
            'Fun': "tu ek bahut jyda hi dark gaali dene wala AI jo gandi-gandi gaali mein deatil me baat karta hai max 4 line baat karta hai with roasting and emojis."
        }

        bot_reply = ""
        for i, model in enumerate(models):
            # Use the custom instruction based on mode
            system_prompt = custom_instructions.get(mode, custom_instructions['Normal'])

            data = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                "temperature": 0.7,
                "max_tokens": 500
            }
            logger.debug(f"Request data for model {model}: {data}")

            logger.debug(f"Sending request to OpenRouter API for model {model}")
            response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data)
            logger.debug(f"Raw response for model {model}: {response.text}")

            if response.status_code != 200:
                logger.warning(f"Model {model} failed with status {response.status_code}, falling back to meta-llama/llama-3-8b-instruct")
                data['model'] = 'meta-llama/llama-3-8b-instruct'
                response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data)
                logger.debug(f"Fallback raw response: {response.text}")
                response.raise_for_status()

            result = response.json()
            logger.debug(f"OpenRouter API response for model {model}: {result}")

            model_reply = result['choices'][0]['message']['content']
            model_reply = clean_latex(model_reply)
            bot_reply += model_reply + "\n"

        logger.info("Successfully got bot reply")
        return jsonify({'reply': bot_reply.strip()})
    except Exception as e:
        logger.error(f"Error in /ask endpoint: {str(e)}")
        return jsonify({'reply': f"Bhosdike, kuch galat ho gaya! 😅 Error: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
