let currentMode = 'Normal';
let currentModel = 'DeepSeek';
let latestConversationHeight = 0;
let isUserScrolling = false;
let isBotReplying = false;
let currentChatName = null;

// Function to parse Markdown and convert to HTML
function renderMessageText(text) {
    // Handle headings (## Heading)
    text = text.replace(/^##\s(.+)$/gm, '<h2>$1</h2>');

    // Handle bold (**Bold**)
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Handle italic (*Italic*)
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Handle bullet points (- Item)
    text = text.replace(/^- (.+)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>.+<\/li>(\n<li>.+<\/li>)*)/g, '<ul>$1</ul>');

    // Handle code blocks (```Code```)
    text = text.replace(/```(.+?)```/gs, '<pre><code>$1</code></pre>');

    // Replace newlines with <br> for paragraphs
    text = text.replace(/\n/g, '<br>');

    return text;
}

function addModelSwitchNotification(chatWindow, model) {
    const notificationMessage = document.createElement('div');
    notificationMessage.className = 'message notification';
    notificationMessage.innerHTML = `
        <div class="message-content">Model switched to ${model}</div>
    `;
    chatWindow.appendChild(notificationMessage);
    scrollToBottom(chatWindow, true);
}

function showPopup(message) {
    const popup = document.createElement('div');
    popup.className = 'popup-message';
    popup.innerHTML = message;
    document.body.appendChild(popup);

    setTimeout(() => {
        popup.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        popup.style.opacity = '0';
        setTimeout(() => {
            popup.remove();
        }, 300);
    }, 3000);
}

async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const sendButton = document.querySelector('.send-button');

    if (!userInput || !sendButton) {
        console.error("userInput or sendButton element not found!");
        return;
    }

    if (isBotReplying) {
        console.log("Bot is replying, message sending blocked.");
        return;
    }

    const inputValue = userInput.value;
    if (!inputValue.trim()) {
        console.log("Input is empty, skipping send.");
        return;
    }

    const chatWindow = document.getElementById('chatWindow');
    const greetingMessage = document.getElementById('greetingMessage');
    const searchBoxWrapper = document.querySelector('.search-box-wrapper');

    if (greetingMessage) {
        console.log("Hiding greeting message");
        greetingMessage.style.display = 'none';
    } else {
        console.error("greetingMessage element not found!");
    }

    const userMessage = document.createElement('div');
    userMessage.className = 'message user';
    userMessage.innerHTML = `
        <div class="message-content">${renderMessageText(inputValue)}</div>
        <div class="message-actions">
            <i class="fas fa-copy action-icon"></i>
            <i class="fas fa-thumbs-up action-icon"></i>
            <i class="fas fa-thumbs-down action-icon"></i>
            <i class="fas fa-share action-icon"></i>
            <i class="fas fa-comment action-icon"></i>
        </div>
    `;
    chatWindow.appendChild(userMessage);

    if (searchBoxWrapper) {
        console.log("Adding 'bottom' class to searchBoxWrapper");
        searchBoxWrapper.classList.add('bottom');
    } else {
        console.error("searchBoxWrapper element not found!");
    }

    isBotReplying = true;
    userInput.disabled = true;
    sendButton.classList.add('faded');

    const thinkingMessage = document.createElement('div');
    thinkingMessage.className = 'message bot thinking';
    thinkingMessage.id = 'thinking-message';
    thinkingMessage.innerHTML = `
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
    `;
    chatWindow.appendChild(thinkingMessage);

    scrollToBottom(chatWindow, true);

    userInput.value = '';
    adjustSearchBoxHeight();

    let models = [currentModel];

    try {
        console.log("Sending request to /ask endpoint with mode:", currentMode, "models:", models);
        const response = await fetch('/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: inputValue,
                mode: currentMode,
                models: models
            }),
        });

        console.log("Response status:", response.status);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const data = await response.json();
        console.log("Received response:", data);

        const thinkingMsgElement = document.getElementById('thinking-message');
        if (thinkingMsgElement) {
            thinkingMsgElement.remove();
        }

        const aiMessage = document.createElement('div');
        aiMessage.className = 'message bot';
        aiMessage.innerHTML = `
            <div class="message-content">${renderMessageText(data.reply)}</div>
            <div class="message-actions">
                <i class="fas fa-copy action-icon"></i>
                <i class="fas fa-thumbs-up action-icon"></i>
                <i class="fas fa-thumbs-down action-icon"></i>
                <i class="fas fa-share action-icon"></i>
                <i class="fas fa-comment action-icon"></i>
            </div>
        `;
        chatWindow.appendChild(aiMessage);

        scrollToBottom(chatWindow, true);

        updateChatHistory();
    } catch (error) {
        console.error("Error in sendMessage:", error.message);
        const thinkingMsgElement = document.getElementById('thinking-message');
        if (thinkingMsgElement) {
            thinkingMsgElement.remove();
        }
        const aiMessage = document.createElement('div');
        aiMessage.className = 'message bot';
        aiMessage.innerHTML = `
            <div class="message-content">Bhosdike, kuch galat ho gaya! 😅 Error: ${error.message}</div>
            <div class="message-actions">
                <i class="fas fa-copy action-icon"></i>
                <i class="fas fa-thumbs-up action-icon"></i>
                <i class="fas fa-thumbs-down action-icon"></i>
                <i class="fas fa-share action-icon"></i>
                <i class="fas fa-comment action-icon"></i>
            </div>
        `;
        chatWindow.appendChild(aiMessage);

        scrollToBottom(chatWindow, true);

        updateChatHistory();
    } finally {
        isBotReplying = false;
        userInput.disabled = false;
        sendButton.classList.remove('faded');
    }
}

async function updateChatHistory() {
    const chatHistoryList = document.getElementById('chatHistoryList');
    if (chatHistoryList) {
        try {
            const response = await fetch('/get_chat_history', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch chat history');
            }
            const data = await response.json();
            if (data.chat_names) {
                chatHistoryList.innerHTML = '';
                data.chat_names.forEach(chatName => {
                    const li = document.createElement('li');
                    li.textContent = chatName;
                    li.onclick = () => loadChat(chatName);
                    chatHistoryList.appendChild(li);
                });
            }
        } catch (error) {
            console.error("Error updating chat history:", error);
        }
    } else {
        console.error("chatHistoryList element not found!");
    }
}

async function loadChat(chatName) {
    const chatWindow = document.getElementById('chatWindow');
    const greetingMessage = document.getElementById('greetingMessage');
    const searchBoxWrapper = document.querySelector('.search-box-wrapper');
    
    if (greetingMessage) {
        console.log("Hiding greeting message in loadChat");
        greetingMessage.style.display = 'none';
    } else {
        console.error("greetingMessage element not found in loadChat!");
    }

    if (searchBoxWrapper) {
        console.log("Moving search box to bottom");
        searchBoxWrapper.classList.add('bottom');
    } else {
        console.error("searchBoxWrapper element not found!");
    }

    try {
        const response = await fetch(`/load_chat/${chatName}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error('Failed to load chat');
        }
        const data = await response.json();
        if (data.history) {
            chatWindow.innerHTML = '';
            data.history.forEach(chat => {
                const userMessage = document.createElement('div');
                userMessage.className = 'message user';
                userMessage.innerHTML = `
                    <div class="message-content">${renderMessageText(chat.user)}</div>
                    <div class="message-actions">
                        <i class="fas fa-copy action-icon"></i>
                        <i class="fas fa-thumbs-up action-icon"></i>
                        <i class="fas fa-thumbs-down action-icon"></i>
                        <i class="fas fa-share action-icon"></i>
                        <i class="fas fa-comment action-icon"></i>
                    </div>
                `;
                chatWindow.appendChild(userMessage);

                const botMessage = document.createElement('div');
                botMessage.className = 'message bot';
                botMessage.innerHTML = `
                    <div class="message-content">${renderMessageText(chat.bot)}</div>
                    <div class="message-actions">
                        <i class="fas fa-copy action-icon"></i>
                        <i class="fas fa-thumbs-up action-icon"></i>
                        <i class="fas fa-thumbs-down action-icon"></i>
                        <i class="fas fa-share action-icon"></i>
                        <i class="fas fa-comment action-icon"></i>
                    </div>
                `;
                chatWindow.appendChild(botMessage);
            });
            scrollToBottom(chatWindow, true);

            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.remove('active');
            }
            const hamburger = document.querySelector('.hamburger');
            if (hamburger) {
                hamburger.classList.remove('active');
            }
            const main = document.querySelector('main');
            if (main) {
                main.classList.remove('sidebar-active');
            }

            const chatWindowElement = document.querySelector('.chat-window');
            if (chatWindowElement) {
                chatWindowElement.style.marginLeft = '0';
            }
            if (greetingMessage) {
                greetingMessage.style.marginLeft = '0';
            }
            if (searchBoxWrapper) {
                searchBoxWrapper.style.marginLeft = '0';
            }
        }
    } catch (error) {
        console.error("Error loading chat:", error);
    }
}

async function startNewChat(event) {
    event.preventDefault();
    const chatWindow = document.getElementById('chatWindow');
    const greetingMessage = document.getElementById('greetingMessage');
    const searchBoxWrapper = document.querySelector('.search-box-wrapper');
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.querySelector('.hamburger');
    const main = document.querySelector('main');

    if (chatWindow) {
        chatWindow.innerHTML = '';
    } else {
        console.error("chatWindow element not found!");
        return;
    }

    if (greetingMessage) {
        console.log("Showing greeting message");
        greetingMessage.style.display = 'block';
    } else {
        console.error("greetingMessage element not found!");
    }

    if (searchBoxWrapper) {
        console.log("Moving search box to center");
        searchBoxWrapper.classList.remove('bottom');
    } else {
        console.error("searchBoxWrapper element not found!");
    }

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
    currentChatName = `Chat_${timestamp}`;
    console.log("Generated temporary chat name:", currentChatName);

    try {
        console.log("Notifying backend to start new chat...");
        const response = await fetch(`/start_new_chat/${currentChatName}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error('Failed to start new chat');
        }
        console.log("New chat started successfully");
        showPopup('New Chat Started! History Reset. 🚀');
    } catch (error) {
        console.error("Error notifying backend for new chat:", error);
    }

    console.log("Updating chat history...");
    await updateChatHistory();

    if (sidebar) {
        sidebar.classList.remove('active');
    } else {
        console.error("sidebar element not found!");
    }
    if (hamburger) {
        hamburger.classList.remove('active');
    } else {
        console.error("hamburger element not found!");
    }
    if (main) {
        main.classList.remove('sidebar-active');
    } else {
        console.error("main element not found!");
    }

    const chatWindowElement = document.querySelector('.chat-window');
    if (chatWindowElement) {
        chatWindowElement.style.marginLeft = '0';
    }
    if (greetingMessage) {
        greetingMessage.style.marginLeft = '0';
    }
    if (searchBoxWrapper) {
        searchBoxWrapper.style.marginLeft = '0';
    }
}

function adjustSearchBoxHeight() {
    const userInput = document.getElementById('userInput');
    const searchBox = document.querySelector('.search-box');
    const buttonRow = document.querySelector('.button-row');

    if (!userInput || !searchBox) {
        console.error("userInput or searchBox element not found in adjustSearchBoxHeight!");
        return;
    }

    userInput.style.height = 'auto';
    searchBox.style.height = 'auto';

    const inputHeight = userInput.scrollHeight;
    userInput.style.height = `${inputHeight}px`;

    const buttonRowHeight = buttonRow ? buttonRow.offsetHeight : 0;
    const padding = 24;
    const newHeight = inputHeight + buttonRowHeight + padding;
    searchBox.style.height = `${newHeight}px`;
}

function scrollToBottom(chatWindow, adjustForLatest = false) {
    if (adjustForLatest && !isUserScrolling) {
        const messages = chatWindow.getElementsByClassName('message');
        if (messages.length >= 2) {
            const latestUserMessage = messages[messages.length - 2];
            const latestBotMessage = messages[messages.length - 1];
            const latestConversationHeight = latestUserMessage.offsetHeight + latestBotMessage.offsetHeight + 48;

            chatWindow.scrollTo({
                top: chatWindow.scrollHeight - latestConversationHeight,
                behavior: 'smooth'
            });

            chatWindow.style.height = `${Math.min(latestConversationHeight, chatWindow.scrollHeight)}px`;
        } else {
            chatWindow.scrollTo({
                top: chatWindow.scrollHeight,
                behavior: 'smooth'
            });
            chatWindow.style.height = 'auto';
        }
    } else {
        chatWindow.scrollTo({
            top: chatWindow.scrollHeight,
            behavior: 'smooth'
        });
        chatWindow.style.height = 'auto';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded");

    const userInput = document.getElementById('userInput');
    const sendButton = document.querySelector('.send-button');
    const newChatLink = document.getElementById('new-chat-link');
    const modeButton = document.querySelector('.mode-button');
    const modelButton = document.querySelector('.model-button');
    const modeDropupContent = document.querySelector('.mode-selector .dropup-content');
    const modelDropupContent = document.querySelector('.model-selector .dropup-content');
    const modeOptions = document.querySelectorAll('.mode-option');
    const modelOptions = document.querySelectorAll('.model-option');
    const greetingMessage = document.getElementById('greetingMessage');
    const chatWindow = document.getElementById('chatWindow');
    const hamburger = document.querySelector('.hamburger');
    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('main');
    const chatWindowElement = document.querySelector('.chat-window');
    const searchBoxWrapper = document.querySelector('.search-box-wrapper');
    const deleteHistoryForm = document.getElementById('delete-history-form');

    currentChatName = "{{ chat_name }}";

    updateChatHistory();

    if (chatWindow) {
        chatWindow.addEventListener('scroll', () => {
            const isAtBottom = chatWindow.scrollHeight - chatWindow.scrollTop <= chatWindow.clientHeight + 1;
            isUserScrolling = !isAtBottom;
        });

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(() => {
                if (!isUserScrolling) {
                    scrollToBottom(chatWindow, true);
                }
            });
        });

        observer.observe(chatWindow, { childList: true, subtree: true });
    }

    if (userInput) {
        userInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                console.log("Enter key pressed, calling sendMessage...");
                sendMessage();
            }
        });

        userInput.addEventListener('input', adjustSearchBoxHeight);
        adjustSearchBoxHeight();
    } else {
        console.error("userInput element not found!");
    }

    if (sendButton) {
        sendButton.addEventListener('click', () => {
            console.log("Send button clicked, calling sendMessage...");
            sendMessage();
        });
    } else {
        console.error("sendButton element not found!");
    }

    if (newChatLink) {
        newChatLink.addEventListener('click', (event) => {
            console.log("New Chat link (sidebar) clicked, starting new chat...");
            startNewChat(event);
        });
    } else {
        console.error("newChatLink element not found!");
    }

    if (deleteHistoryForm) {
        deleteHistoryForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            try {
                const response = await fetch('/delete_history', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                const data = await response.json();
                if (data.status === 'success') {
                    showPopup('Chat History Deleted! 🗑️');
                    updateChatHistory();
                    if (chatWindow) {
                        chatWindow.innerHTML = '';
                    }
                    if (greetingMessage) {
                        greetingMessage.style.display = 'block';
                    }
                    if (searchBoxWrapper) {
                        searchBoxWrapper.classList.remove('bottom');
                    }
                    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
                    currentChatName = `Chat_${timestamp}`;
                    console.log("Generated new chat name after deletion:", currentChatName);
                    await fetch(`/start_new_chat/${currentChatName}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    });
                } else {
                    console.error("Failed to delete history:", data.message);
                    showPopup('Failed to Delete History! 😓');
                }
            } catch (error) {
                console.error("Error deleting history:", error);
                showPopup('Bhosdike, kuch galat ho gaya! 😅');
            }
        });
    } else {
        console.error("deleteHistoryForm element not found!");
    }

    if (modeButton && modeDropupContent) {
        modeButton.addEventListener('click', () => {
            console.log("Mode button clicked");
            const isVisible = modeDropupContent.style.display === 'block';
            modeDropupContent.style.display = isVisible ? 'none' : 'block';
        });

        modeOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const selectedMode = option.getAttribute('data-mode');
                currentMode = selectedMode;

                modeButton.innerHTML = `${selectedMode} <i class="fas fa-chevron-up"></i>`;

                modeOptions.forEach(opt => opt.classList.remove('highlighted'));

                option.classList.add('highlighted');

                modeDropupContent.style.display = 'none';
            });
        });

        document.addEventListener('click', (e) => {
            if (!modeButton.contains(e.target) && !modeDropupContent.contains(e.target)) {
                modeDropupContent.style.display = 'none';
            }
        });
    } else {
        console.error("modeButton or modeDropupContent element not found!");
    }

    if (modelButton && modelDropupContent) {
        modelButton.innerHTML = `${currentModel} <i class="fas fa-chevron-up"></i>`;

        modelOptions.forEach(option => {
            if (option.getAttribute('data-model') === currentModel) {
                option.classList.add('highlighted');
            } else {
                option.classList.remove('highlighted');
            }
        });

        modelButton.addEventListener('click', () => {
            console.log("Model button clicked");
            const isVisible = modelDropupContent.style.display === 'block';
            modelDropupContent.style.display = isVisible ? 'none' : 'block';
        });

        modelOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const selectedModel = option.getAttribute('data-model');
                currentModel = selectedModel;

                addModelSwitchNotification(chatWindow, currentModel);
                showPopup('Model Switched! History Reset. 🔄');

                modelButton.innerHTML = `${selectedModel} <i class="fas fa-chevron-up"></i>`;

                modelOptions.forEach(opt => opt.classList.remove('highlighted'));

                option.classList.add('highlighted');

                modelDropupContent.style.display = 'none';
            });
        });

        document.addEventListener('click', (e) => {
            if (!modelButton.contains(e.target) && !modelDropupContent.contains(e.target)) {
                modelDropupContent.style.display = 'none';
            }
        });
    } else {
        console.error("modelButton or modelDropupContent element not found!");
    }

    if (hamburger && sidebar && main && chatWindowElement && searchBoxWrapper) {
        console.log("Hamburger, sidebar, main, chatWindowElement, and searchBoxWrapper elements found, setting up toggle");
        hamburger.addEventListener('click', () => {
            console.log("Hamburger clicked, toggling sidebar");
            hamburger.classList.toggle('active');
            sidebar.classList.toggle('active');
            main.classList.toggle('sidebar-active');

            if (window.innerWidth >= 1025) {
                const shiftAmount = '300px';
                if (main.classList.contains('sidebar-active')) {
                    chatWindowElement.style.marginLeft = shiftAmount;
                    if (greetingMessage) greetingMessage.style.marginLeft = shiftAmount;
                    searchBoxWrapper.style.marginLeft = shiftAmount;
                } else {
                    chatWindowElement.style.marginLeft = '0';
                    if (greetingMessage) greetingMessage.style.marginLeft = '0';
                    searchBoxWrapper.style.marginLeft = '0';
                }
            }
        });
    } else {
        console.error("Hamburger, sidebar, main, chatWindowElement, or searchBoxWrapper element not found!");
    }

    if (greetingMessage) {
        greetingMessage.style.display = 'block';
    }
});

window.addEventListener('beforeunload', () => {
    sessionStorage.removeItem('currentChatName');
});
