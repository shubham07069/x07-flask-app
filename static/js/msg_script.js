const socket = io();

function renderMessage(message) {
    const chatWindow = document.getElementById('chatWindow');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender_id == {{ current_user.id }} ? 'user' : 'bot'}`;
    messageDiv.innerHTML = `
        <div class="message-content">
            <strong>${message.sender_username}:</strong> ${message.content}
            <br><small>${message.timestamp}</small>
        </div>
    `;
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function selectUser(userId) {
    window.location.href = `/messaging?user_id=${userId}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('userInput');
    const sendButton = document.querySelector('.send-button');
    const chatWindow = document.getElementById('chatWindow');

    if (userInput && sendButton) {
        sendButton.addEventListener('click', () => {
            const content = userInput.value.trim();
            if (content && selectedUserId) {
                socket.emit('send_message', {
                    receiver_id: selectedUserId,
                    content: content
                });
                userInput.value = '';
            }
        });

        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const content = userInput.value.trim();
                if (content && selectedUserId) {
                    socket.emit('send_message', {
                        receiver_id: selectedUserId,
                        content: content
                    });
                    userInput.value = '';
                }
            }
        });

        userInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = `${this.scrollHeight}px`;
        });
    }

    const hamburger = document.querySelector('.hamburger');
    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('main');
    if (hamburger && sidebar && main) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            sidebar.classList.toggle('active');
            main.classList.toggle('sidebar-active');
        });
    }

    socket.on('receive_message', (message) => {
        if ((message.sender_id == {{ current_user.id }} && message.receiver_id == selectedUserId) ||
            (message.sender_id == selectedUserId && message.receiver_id == {{ current_user.id }})) {
            renderMessage(message);
        }
    });
});
