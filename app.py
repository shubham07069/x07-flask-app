from flask import Flask, render_template, request, session, redirect, url_for
from flask_socketio import SocketIO, join_room, emit
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from datetime import datetime
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'  # Using SQLite for simplicity
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize SocketIO with CORS allowed
socketio = SocketIO(app, cors_allowed_origins="*")

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Dummy database models (for simplicity, assuming SQLAlchemy is used)
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy(app)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    profile_pic = db.Column(db.String(120), nullable=True)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, nullable=False)
    receiver_id = db.Column(db.Integer, nullable=True)
    group_id = db.Column(db.Integer, nullable=True)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    edited = db.Column(db.Boolean, default=False)
    disappear_timer = db.Column(db.Integer, nullable=True)

class Group(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    is_channel = db.Column(db.Boolean, default=False)

# Create database tables
with app.app_context():
    db.create_all()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Routes
@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('messaging'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        if user and user.password == password:  # In real app, use hashed passwords
            login_user(user)
            return redirect(url_for('messaging'))
        return 'Invalid credentials, bhai! 😅'
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html')

@app.route('/status')
@login_required
def status():
    return render_template('status.html')

@app.route('/create_group')
@login_required
def create_group():
    return render_template('create_group.html')

@app.route('/messaging')
@login_required
def messaging():
    users = User.query.all()
    groups = Group.query.all()
    return render_template('messaging.html', users=users, groups=groups)

# Socket.IO Events
@socketio.on('join')
def on_join(data):
    room = data['room']
    join_room(room)
    print(f"User {current_user.username} joined room: {room}")

@socketio.on('send_message')
def handle_send_message(data):
    receiver_id = data.get('receiver_id')
    group_id = data.get('group_id')
    content = data['content']
    content_type = data['content_type']

    # Save message to database
    message = Message(
        sender_id=current_user.id,
        receiver_id=receiver_id if receiver_id else None,
        group_id=group_id if group_id else None,
        content=content,
        timestamp=datetime.utcnow()
    )
    db.session.add(message)
    db.session.commit()

    # Emit message to room
    room = group_id if group_id else f"chat_{min(current_user.id, int(receiver_id))}_{max(current_user.id, int(receiver_id))}"
    emit('receive_message', {
        'message_id': message.id,
        'sender_id': current_user.id,
        'content': content,
        'timestamp': message.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
        'edited': False
    }, room=room)

@socketio.on('message_read')
def handle_message_read(data):
    message_id = data['message_id']
    room = data['room']
    # Handle message read status if needed
    print(f"Message {message_id} read in room {room}")

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
