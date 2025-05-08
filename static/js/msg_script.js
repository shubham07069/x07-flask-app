const socket = io();
let typingTimeout;
let isTyping = false;

function renderMessage(message) {
    const chatWindow = document.getElementById('chatWindow');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender_id == currentUserId ? 'user' : 'bot'}`;
    messageDiv.setAttribute('data-message-id', message.message_id);

    let contentHtml = '';
    if (message.content_type === 'text') {
        contentHtml = message.content;
    } else if (message.content_type === 'image') {
        contentHtml = `<img src="/${message.file_path}" alt="Image" style="max-width: 200px;">`;
    } else if (message.content_type === 'video') {
        contentHtml = `<video controls style="max-width: 200px;"><source src="/${message.file_path}" type="video/mp4">Your browser does not support the video tag.</video>`;
    } else {
        contentHtml = `<a href="/${message.file_path}" target="_blank">Download File</a>`;
    }

    messageDiv.innerHTML = `
        <div class="message-content">
            <strong>${message.sender_username}:</strong> ${contentHtml}
            <br><small>${message.timestamp}</small>
            ${message.sender_id == currentUserId ? `<span class="read-status"><i class="fas fa-check" style="color: #ccc;"></i> Delivered</span>` : ''}
        </div>
    `;
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    // Mark message as read if not the sender
    if (message.sender_id != currentUserId) {
        socket.emit('message_read', { message_id: message.message_id });
    }
}

function selectUser(userId) {
    window.location.href = `/messaging?user_id=${userId}`;
}

function selectGroup(groupId) {
    window.location.href = `/messaging?group_id=${groupId}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('userInput');
    const sendButton = document.querySelector('.send-button');
    const fileInput = document.getElementById('fileInput');
    const chatWindow = document.getElementById('chatWindow');
    const typingIndicator = document.getElementById('typing-indicator');

    // Join chat room
    let room;
    if (chatType === 'user' && selectedUserId) {
        room = `chat_${Math.min(currentUserId, selectedUserId)}_${Math.max(currentUserId, selectedUserId)}`;
        socket.emit('join', { room: room });
    } else if (chatType === 'group' && selectedGroupId) {
        room = `group_${selectedGroupId}`;
        socket.emit('join', { room: room });
    }

    if (userInput && sendButton) {
        sendButton.addEventListener('click', () => {
            const content = userInput.value.trim();
            if (content) {
                socket.emit('send_message', {
                    receiver_id: selectedUserId,
                    group_id: selectedGroupId,
                    content: content,
                    content_type: 'text'
                });
                userInput.value = '';
                socket.emit('stop_typing', { room: room });
                isTyping = false;
            }
        });

        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const content = userInput.value.trim();
                if (content) {
                    socket.emit('send_message', {
                        receiver_id: selectedUserId,
                        group_id: selectedGroupId,
                        content: content,
                        content_type: 'text'
                    });
                    userInput.value = '';
                    socket.emit('stop_typing', { room: room });
                    isTyping = false;
                }
            }
        });

        userInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = `${this.scrollHeight}px`;

            if (!isTyping) {
                socket.emit('typing', { room: room });
                isTyping = true;
            }
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                socket.emit('stop_typing', { room: room });
                isTyping = false;
            }, 1000);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const formData = new FormData();
                formData.append('file', file);

                fetch('/upload_file', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.file_path) {
                        socket.emit('send_message', {
                            receiver_id: selectedUserId,
                            group_id: selectedGroupId,
                            content: file.name,
                            content_type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
                            file_path: data.file_path
                        });
                    }
                })
                .catch(error => console.error('Error uploading file:', error));
                e.target.value = '';
            }
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
        if ((chatType === 'user' && message.sender_id != currentUserId && message.sender_id == selectedUserId) ||
            (chatType === 'group' && message.group_id == selectedGroupId)) {
            renderMessage(message);
        }
    });

    socket.on('user_status', (data) => {
        const statusElement = document.getElementById(`status-${data.user_id}`);
        const statusHeaderElement = document.getElementById(`status-header-${data.user_id}`);
        if (statusElement) {
            statusElement.innerText = data.status === 'online' ? 'Online' : `Last seen: ${data.last_seen}`;
        }
        if (statusHeaderElement) {
            statusHeaderElement.innerText = data.status === 'online' ? 'Online' : `Last seen: ${data.last_seen}`;
        }
    });

    socket.on('typing', (data) => {
        if (data.user_id != currentUserId) {
            typingIndicator.innerText = `${data.username} is typing...`;
        }
    });

    socket.on('stop_typing', (data) => {
        if (data.user_id != currentUserId) {
            typingIndicator.innerText = '';
        }
    });

    socket.on('message_read', (data) => {
        const messageDiv = document.querySelector(`.message[data-message-id="${data.message_id}"]`);
        if (messageDiv) {
            const readStatus = messageDiv.querySelector('.read-status');
            if (readStatus) {
                readStatus.innerHTML = '<i class="fas fa-check-double" style="color: #34b7f1;"></i> Seen';
            }
        }
    });
});
