from flask import Flask, request, jsonify, render_template, redirect, url_for, flash, session
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import requests
from dotenv import load_dotenv
import os
import logging
import re

app = Flask(__name__)

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables from .env
load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
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

@app.route('/')
def home():
    logger.info("Serving home page")
    if current_user.is_authenticated:
        return redirect(url_for('chat'))
    return render_template('index.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        if User.query.filter_by(username=username).first():
            flash('Username already exists! Try a different one.', 'error')
            return redirect(url_for('register'))
        
        user = User(username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        flash('Registration successful! Please log in.', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html')

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
        models = data.get('models', ['deepseek/deepseek-chat-v3-0324'])  # Updated default model
        custom_instructions = data.get('customInstructions', [''])

        logger.debug(f"User message: {user_message}")
        logger.debug(f"Mode: {mode}")
        logger.debug(f"Models: {models}")
        logger.debug(f"Custom Instructions: {custom_instructions}")

        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://x07.in",  # Required by OpenRouter
            "X-Title": "ChatGod"  # Required by OpenRouter
        }
        logger.debug(f"Headers: {headers}")

        # Prepare bot reply by combining responses from all models
        bot_reply = ""
        for i, model in enumerate(models):
            instruction = custom_instructions[i] if i < len(custom_instructions) else ''
            
            # Default system prompt for Normal mode if no custom instruction
            system_prompt = instruction if instruction else (
                "You are ChatGod, a friendly and witty AI with a desi vibe. "
                "Answer in a casual, conversational tone using Hindi slang like 'bhai', 'laude', 'dhang se', etc., "
                "and add some humor with emojis 😎🚀. Avoid formal language and LaTeX formatting. "
                "Keep replies simple, fun, and engaging, like you're talking to a friend."
            )

            data = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                "temperature": 0.7,  # Added for better response quality
                "max_tokens": 500  # Added to limit response length
            }
            logger.debug(f"Request data for model {model}: {data}")

            logger.debug(f"Sending request to OpenRouter API for model {model}")
            response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data)
            logger.debug(f"Raw response for model {model}: {response.text}")

            if response.status_code != 200:
                # Fallback to a known working model if the current model fails
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
