document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded, initializing script...");

    const current_user_id = window.current_user_id;
    const socket = io();

    // Hamburger Menu Toggle
    const hamburger = document.querySelector('.hamburger');
    const sidebar = document.querySelector('.sidebar');
    if (hamburger && sidebar) {
        console.log("Hamburger and sidebar found, attaching event listener...");
        hamburger.addEventListener('click', () => {
            console.log("Hamburger clicked!");
            sidebar.classList.toggle('-translate-x-full');
            hamburger.classList.toggle('active');
        });
    } else {
        console.error("Hamburger or sidebar not found!");
    }

    // Dropdown Menu Toggle
    document.querySelectorAll('.chat-header button').forEach(button => {
        button.addEventListener('click', () => {
            console.log("Dropdown button clicked!");
            const dropdown = button.nextElementSibling;
            if (dropdown) dropdown.classList.toggle('hidden');
        });
    });

    // Tab Switching (PC)
    const chatTab = document.querySelector('.chat-tab');
    const groupTab = document.querySelector('.group-tab');
    const chatList = document.querySelector('.chat-list');
    const groupList = document.querySelector('.group-list');

    if (chatTab && groupTab && chatList && groupList) {
        console.log("PC tabs found, attaching event listeners...");
        chatTab.addEventListener('click', () => {
            console.log("Chat tab clicked!");
            chatTab.classList.add('active');
            groupTab.classList.remove('active');
            chatList.classList.remove('hidden');
            groupList.classList.add('hidden');
        });

        groupTab.addEventListener('click', () => {
            console.log("Group tab clicked!");
            groupTab.classList.add('active');
            chatTab.classList.remove('active');
            groupList.classList.remove('hidden');
            chatList.classList.add('hidden');
        });
    } else {
        console.error("PC tabs not found!");
    }

    // Tab Switching (Mobile)
    const chatTabMobile = document.querySelector('.chat-tab-mobile');
    const groupTabMobile = document.querySelector('.group-tab-mobile');
    const chatListMobile = document.querySelector('.chat-list-content');
    const groupListMobile = document.querySelector('.group-list-content');

    if (chatTabMobile && groupTabMobile && chatListMobile && groupListMobile) {
        console.log("Mobile tabs found, attaching event listeners...");
        chatTabMobile.addEventListener('click', () => {
            console.log("Chat tab mobile clicked!");
            chatTabMobile.classList.add('active');
            groupTabMobile.classList.remove('active');
            chatListMobile.classList.remove('hidden');
            groupListMobile.classList.add('hidden');
        });

        groupTabMobile.addEventListener('click', () => {
            console.log("Group tab mobile clicked!");
            groupTabMobile.classList.add('active');
            chatTabMobile.classList.remove('active');
            groupListMobile.classList.remove('hidden');
            chatListMobile.classList.add('hidden');
        });
    } else {
        console.error("Mobile tabs not found!");
    }

    // Emoji Picker Setup
    const emojiBtnPc = document.querySelector('.emoji-btn');
    const emojiPanelPc = document.querySelector('#emoji-panel-pc');
    const messageInputPc = document.querySelector('#message-content-pc');
    const emojiBtnMobile = document.querySelector('#chatting-page-mobile .emoji-btn');
    const emojiPanelMobile = document.querySelector('#emoji-panel-mobile');
    const messageInputMobile = document.querySelector('#message-content-mobile');

    if (emojiBtnPc && emojiPanelPc && messageInputPc) {
        console.log("Setting up emoji picker for PC...");
        const pickerPc = new emojiMart.Picker({
            onEmojiSelect: (emoji) => {
                console.log("Emoji selected on PC:", emoji.native);
                messageInputPc.value += emoji.native;
                emojiPanelPc.classList.add('hidden');
            }
        });
        emojiPanelPc.appendChild(pickerPc);

        emojiBtnPc.addEventListener('click', () => {
            console.log("Emoji button clicked on PC!");
            emojiPanelPc.classList.toggle('hidden');
        });
    } else {
        console.error("Emoji picker elements for PC not found!");
    }

    if (emojiBtnMobile && emojiPanelMobile && messageInputMobile) {
        console.log("Setting up emoji picker for Mobile...");
        const pickerMobile = new emojiMart.Picker({
            onEmojiSelect: (emoji) => {
                console.log("Emoji selected on Mobile:", emoji.native);
                messageInputMobile.value += emoji.native;
                emojiPanelMobile.classList.add('hidden');
            }
        });
        emojiPanelMobile.appendChild(pickerMobile);

        emojiBtnMobile.addEventListener('click', () => {
            console.log("Emoji button clicked on Mobile!");
            emojiPanelMobile.classList.toggle('hidden');
        });
    } else {
        console.error("Emoji picker elements for Mobile not found!");
    }

    // Chat Functions (PC)
    const usersList = {{ users | tojson }};
    const groupsList = {{ groups | tojson }};

    function openChat(id, type) {
        console.log(`Opening chat for ${type} with ID: ${id}`);
        const chatArea = document.querySelector('#chat-area-pc');
        const noSelection = document.querySelector('.no-selection');
        
        if (!chatArea || !noSelection) {
            console.error("Chat area or no-selection element not found!");
            return;
        }

        noSelection.classList.add('hidden');
        chatArea.classList.remove('hidden');
        chatArea.dataset.chatId = id;
        chatArea.dataset.chatType = type;

        const headerImg = document.querySelector('#chat-header-img');
        const headerName = document.querySelector('#chat-header-name');
        const receiverIdInput = document.querySelector('#receiver-id-pc');
        const groupIdInput = document.querySelector('#group-id-pc');
        const messagesContainer = document.querySelector('#chat-messages-pc');

        if (!headerImg || !headerName || !receiverIdInput || !groupIdInput || !messagesContainer) {
            console.error("Chat header elements or messages container not found!");
            return;
        }

        if (type === 'user') {
            const user = usersList.find(u => u.id == parseInt(id));
            if (user) {
                headerImg.src = user.profile_pic ? `/uploads/profile_pics/${user.profile_pic}` : '/static/images/default_profile.jpg';
                headerName.textContent = user.username;
                receiverIdInput.value = id;
                groupIdInput.value = '';
            } else {
                console.error(`User with ID ${id} not found`);
                return;
            }
        } else {
            const group = groupsList.find(g => g.id == parseInt(id));
            if (group) {
                headerImg.src = '/static/images/group_icon.png';
                headerName.textContent = group.name + (group.is_channel ? ' (Channel)' : '');
                receiverIdInput.value = '';
                groupIdInput.value = id;
            } else {
                console.error(`Group with ID ${id} not found`);
                return;
            }
        }

        fetch(`/messaging?${type === 'user' ? 'user_id' : 'group_id'}=${id}&chat_type=${type}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.text();
            })
            .then(html => {
                console.log('Fetched HTML:', html);
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const messages = doc.querySelectorAll('.message');
                messagesContainer.innerHTML = '';
                if (messages.length > 0) {
                    messages.forEach(message => {
                        const messageDiv = document.createElement('div');
                        messageDiv.classList.add('message', message.classList.contains('sent') ? 'sent' : 'received', 'mb-4', 'max-w-[70%]', 'p-3', 'rounded-lg', 'relative', 'transition-opacity', 'duration-300');
                        messageDiv.setAttribute('data-id', message.dataset.id || '');
                        messageDiv.innerHTML = `
                            <div>${message.querySelector('div') ? message.querySelector('div').innerText : 'No content'}</div>
                            <div class="timestamp text-xs text-gray-500 absolute bottom-[-1.5rem] right-2">${message.querySelector('.timestamp') ? message.querySelector('.timestamp').innerText : ''}${message.classList.contains('edited') ? ' (Edited)' : ''}</div>
                            ${message.classList.contains('sent') ? `
                                <div class="message-actions flex gap-2 mt-2 opacity-0 transition-opacity duration-300">
                                    <button onclick="editMessage(${message.dataset.id})" class="bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-500">Edit</button>
                                    <select onchange="setDisappearTimer(${message.dataset.id}, this.value)" class="bg-gray-600 text-white px-2 py-1 rounded">
                                        <option value="0">No Timer</option>
                                        <option value="10">10s</option>
                                        <option value="60">1min</option>
                                        <option value="3600">1hr</option>
                                    </select>
                                </div>
                            ` : ''}
                        `;
                        messagesContainer.appendChild(messageDiv);
                    });
                } else {
                    messagesContainer.innerHTML = '<div class="text-gray-400 text-center">No messages yet, bhai! Start chatting! 😎</div>';
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                const room = groupIdInput.value ? `group_${groupIdInput.value}` : `chat_${Math.min(current_user_id, parseInt(receiverIdInput.value))}_${Math.max(current_user_id, parseInt(receiverIdInput.value))}`;
                console.log(`Joining room: ${room}`);
                socket.emit('join', { room: room });
            })
            .catch(error => {
                console.error('Error fetching messages:', error);
                messagesContainer.innerHTML = '<div class="text-red-500 text-center">Error loading messages, bhai! 😅</div>';
            });
    }

    function openChatMobile(id, type) {
        console.log(`Opening mobile chat for ${type} with ID: ${id}`);
        const chatListMobile = document.querySelector('.chat-list-mobile');
        const chattingPage = document.querySelector('#chatting-page-mobile');
        
        if (!chatListMobile || !chattingPage) {
            console.error("Chat list mobile or chatting page not found!");
            return;
        }

        chatListMobile.classList.add('hidden');
        chattingPage.classList.remove('hidden');
        chattingPage.dataset.chatId = id;
        chattingPage.dataset.chatType = type;

        const headerImg = document.querySelector('#chat-header-img-mobile');
        const headerName = document.querySelector('#chat-header-name-mobile');
        const receiverIdInput = document.querySelector('#receiver-id-mobile');
        const groupIdInput = document.querySelector('#group-id-mobile');
        const messagesContainer = document.querySelector('#chat-messages-mobile');

        if (!headerImg || !headerName || !receiverIdInput || !groupIdInput || !messagesContainer) {
            console.error("Chat header elements or messages container for mobile not found!");
            return;
        }

        if (type === 'user') {
            const user = usersList.find(u => u.id == parseInt(id));
            if (user) {
                headerImg.src = user.profile_pic ? `/uploads/profile_pics/${user.profile_pic}` : '/static/images/default_profile.jpg';
                headerName.textContent = user.username;
                receiverIdInput.value = id;
                groupIdInput.value = '';
            } else {
                console.error(`User with ID ${id} not found`);
                return;
            }
        } else {
            const group = groupsList.find(g => g.id == parseInt(id));
            if (group) {
                headerImg.src = '/static/images/group_icon.png';
                headerName.textContent = group.name + (group.is_channel ? ' (Channel)' : '');
                receiverIdInput.value = '';
                groupIdInput.value = id;
            } else {
                console.error(`Group with ID ${id} not found`);
                return;
            }
        }

        fetch(`/messaging?${type === 'user' ? 'user_id' : 'group_id'}=${id}&chat_type=${type}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.text();
            })
            .then(html => {
                console.log('Fetched HTML (Mobile):', html);
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const messages = doc.querySelectorAll('.message');
                messagesContainer.innerHTML = '';
                if (messages.length > 0) {
                    messages.forEach(message => {
                        const messageDiv = document.createElement('div');
                        messageDiv.classList.add('message', message.classList.contains('sent') ? 'sent' : 'received', 'mb-4', 'max-w-[70%]', 'p-3', 'rounded-lg', 'relative', 'transition-opacity', 'duration-300');
                        messageDiv.setAttribute('data-id', message.dataset.id || '');
                        messageDiv.innerHTML = `
                            <div>${message.querySelector('div') ? message.querySelector('div').innerText : 'No content'}</div>
                            <div class="timestamp text-xs text-gray-500 absolute bottom-[-1.5rem] right-2">${message.querySelector('.timestamp') ? message.querySelector('.timestamp').innerText : ''}${message.classList.contains('edited') ? ' (Edited)' : ''}</div>
                            ${message.classList.contains('sent') ? `
                                <div class="message-actions flex gap-2 mt-2 opacity-0 transition-opacity duration-300">
                                    <button onclick="editMessage(${message.dataset.id})" class="bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-500">Edit</button>
                                    <select onchange="setDisappearTimer(${message.dataset.id}, this.value)" class="bg-gray-600 text-white px-2 py-1 rounded">
                                        <option value="0">No Timer</option>
                                        <option value="10">10s</option>
                                        <option value="60">1min</option>
                                        <option value="3600">1hr</option>
                                    </select>
                                </div>
                            ` : ''}
                        `;
                        messagesContainer.appendChild(messageDiv);
                    });
                } else {
                    messagesContainer.innerHTML = '<div class="text-gray-400 text-center">No messages yet, bhai! Start chatting! 😎</div>';
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                const room = groupIdInput.value ? `group_${groupIdInput.value}` : `chat_${Math.min(current_user_id, parseInt(receiverIdInput.value))}_${Math.max(current_user_id, parseInt(receiverIdInput.value))}`;
                console.log(`Joining room (Mobile): ${room}`);
                socket.emit('join', { room: room });
            })
            .catch(error => {
                console.error('Error fetching messages (Mobile):', error);
                messagesContainer.innerHTML = '<div class="text-red-500 text-center">Error loading messages, bhai! 😅</div>';
            });
    }

    function backToChatList() {
        const chattingPage = document.querySelector('#chatting-page-mobile');
        const chatListMobile = document.querySelector('.chat-list-mobile');
        if (chattingPage && chatListMobile) {
            console.log("Back to chat list clicked!");
            chattingPage.classList.add('hidden');
            chatListMobile.classList.remove('hidden');
        } else {
            console.error("Chatting page or chat list mobile not found!");
        }
    }

    function sendMessage(event) {
        event.preventDefault();
        const isMobile = !event.target.id.includes('pc');
        const receiverIdInput = document.querySelector(`#receiver-id-${isMobile ? 'mobile' : 'pc'}`);
        const groupIdInput = document.querySelector(`#group-id-${isMobile ? 'mobile' : 'pc'}`);
        const messageInput = document.querySelector(`#message-content-${isMobile ? 'mobile' : 'pc'}`);

        if (!receiverIdInput || !groupIdInput || !messageInput) {
            console.error("Message input elements not found!");
            return;
        }

        const receiverId = receiverIdInput.value;
        const groupId = groupIdInput.value;
        const content = messageInput.value.trim();
        if (!content) return;

        console.log("Sending message:", content);
        socket.emit('send_message', {
            receiver_id: receiverId,
            group_id: groupId,
            content: content,
            content_type: 'text'
        });

        messageInput.value = '';
    }

    function editMessage(messageId) {
        const messageDiv = document.querySelector(`.message[data-id="${messageId}"]`);
        if (!messageDiv) {
            console.error(`Message with ID ${messageId} not found!`);
            return;
        }

        const content = messageDiv.querySelector('div').innerText;
        const newContent = prompt("Edit your message:", content);
        if (newContent && newContent !== content) {
            console.log(`Editing message ID ${messageId} with new content: ${newContent}`);
            fetch(`/edit_message/${messageId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `content=${encodeURIComponent(newContent)}`
            }).then(response => response.json()).then(data => {
                if (data.message) {
                    alert(data.message);
                } else {
                    alert(data.error);
                }
            });
        }
    }

    function setDisappearTimer(messageId, timer) {
        console.log(`Setting disappear timer for message ID ${messageId} to ${timer} seconds`);
        fetch(`/set_disappear_timer/${messageId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `timer=${timer}`
        }).then(response => response.json()).then(data => {
            if (data.message) {
                alert(data.message);
            } else {
                alert(data.error);
            }
        });
    }

    function muteChat() {
        alert('Chat muted!');
    }

    function blockChat() {
        alert('Chat blocked!');
    }

    // Add event listeners dynamically
    const chatMessagesPc = document.getElementById('chat-messages-pc');
    const chatMessagesMobile = document.getElementById('chat-messages-mobile');

    // PC Chat Items
    document.querySelectorAll('.chat-list .chat-item').forEach(item => {
        item.addEventListener('click', () => {
            console.log(`Chat item clicked with ID: ${item.dataset.id}, Type: ${item.dataset.type}`);
            const id = item.dataset.id;
            const type = item.dataset.type;
            openChat(id, type);
        });
    });

    document.querySelectorAll('.group-list .group-item:not(.create-group)').forEach(item => {
        item.addEventListener('click', () => {
            console.log(`Group item clicked with ID: ${item.dataset.id}, Type: ${item.dataset.type}`);
            const id = item.dataset.id;
            const type = item.dataset.type;
            openChat(id, type);
        });
    });

    // Mobile Chat Items
    document.querySelectorAll('.chat-list-content .chat-item').forEach(item => {
        item.addEventListener('click', () => {
            console.log(`Mobile chat item clicked with ID: ${item.dataset.id}, Type: ${item.dataset.type}`);
            const id = item.dataset.id;
            const type = item.dataset.type;
            openChatMobile(id, type);
        });
    });

    document.querySelectorAll('.group-list-content .group-item:not(.create-group)').forEach(item => {
        item.addEventListener('click', () => {
            console.log(`Mobile group item clicked with ID: ${item.dataset.id}, Type: ${item.dataset.type}`);
            const id = item.dataset.id;
            const type = item.dataset.type;
            openChatMobile(id, type);
        });
    });

    // Create Group Link
    document.querySelectorAll('.create-group').forEach(item => {
        item.addEventListener('click', () => {
            console.log("Create group clicked!");
            window.location.href = '{{ url_for('create_group') }}';
        });
    });

    socket.on('receive_message', (data) => {
        console.log("Received message:", data);
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', data.sender_id == current_user_id ? 'sent' : 'received', 'mb-4', 'max-w-[70%]', 'p-3', 'rounded-lg', 'relative', 'transition-opacity', 'duration-300');
        messageDiv.setAttribute('data-id', data.message_id);
        messageDiv.innerHTML = `
            <div>${data.content}</div>
            <div class="timestamp text-xs text-gray-500 absolute bottom-[-1.5rem] right-2">${data.timestamp}${data.edited ? ' (Edited)' : ''}</div>
            ${data.sender_id == current_user_id ? `
                <div class="message-actions flex gap-2 mt-2 opacity-0 transition-opacity duration-300">
                    <button onclick="editMessage(${data.message_id})" class="bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-500">Edit</button>
                    <select onchange="setDisappearTimer(${data.message_id}, this.value)" class="bg-gray-600 text-white px-2 py-1 rounded">
                        <option value="0">No Timer</option>
                        <option value="10">10s</option>
                        <option value="60">1min</option>
                        <option value="3600">1hr</option>
                    </select>
                </div>
            ` : ''}
        `;
        if (chatMessagesPc && !chatMessagesPc.classList.contains('hidden')) {
            chatMessagesPc.appendChild(messageDiv);
            chatMessagesPc.scrollTop = chatMessagesPc.scrollHeight;
        }
        if (chatMessagesMobile && !chatMessagesMobile.classList.contains('hidden')) {
            chatMessagesMobile.appendChild(messageDiv);
            chatMessagesMobile.scrollTop = chatMessagesMobile.scrollHeight;
        }

        if (data.sender_id != current_user_id) {
            const room = data.group_id ? `group_${data.group_id}` : `chat_${Math.min(current_user_id, data.sender_id)}_${Math.max(current_user_id, data.sender_id)}`;
            socket.emit('message_read', { message_id: data.message_id, room: room });
        }

        if (data.disappear_timer) {
            setTimeout(() => {
                messageDiv.remove();
            }, data.disappear_timer * 1000);
        }
    });

    socket.on('message_edited', (data) => {
        console.log("Message edited:", data);
        const messageDiv = document.querySelector(`.message[data-id="${data.message_id}"]`);
        if (messageDiv) {
            messageDiv.querySelector('div').innerText = data.content;
            messageDiv.querySelector('.timestamp').innerText = `${messageDiv.querySelector('.timestamp').innerText.split(' (Edited)')[0]} (Edited)`;
        }
    });

    socket.on('disappear_timer_set', (data) => {
        console.log("Disappear timer set:", data);
        const messageDiv = document.querySelector(`.message[data-id="${data.message_id}"]`);
        if (messageDiv && data.timer > 0) {
            setTimeout(() => {
                messageDiv.remove();
            }, data.timer * 1000);
        }
    });

    document.querySelectorAll('.message.sent').forEach(message => {
        message.addEventListener('mouseenter', () => {
            const actions = message.querySelector('.message-actions');
            if (actions) actions.classList.remove('opacity-0');
        });
        message.addEventListener('mouseleave', () => {
            const actions = message.querySelector('.message-actions');
            if (actions) actions.classList.add('opacity-0');
        });
    });
});
