let currentMode = 'Normal'; // Default mode
let currentModel = 'Grok'; // Default model
let latestConversationHeight = 0; // To store height of latest conversation
let isUserScrolling = false; // Flag to track if user is manually scrolling
let isBotReplying = false; // Flag to track if bot is replying
let currentChatName = null; // Current chat name

// Function to render Markdown-like text (bold and emojis)
function renderMessageText(text) {
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return text;
}

// Function to add model switch notification to chat
function addModelSwitchNotification(chatWindow, model) {
    const notificationMessage = document.createElement('div');
    notificationMessage.className = 'message notification';
    notificationMessage.innerHTML = `
        <div class="message-content">Model switched to ${model}</div>
    `;
    chatWindow.appendChild(notificationMessage);
    scrollToBottom(chatWindow, true);
}

async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const sendButton = document.querySelector('.send-button');

    if (!userInput || !sendButton) {
        console.error("userInput or sendButton element not found!");
        return;
    }

    // Prevent sending message while bot is replying
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

    // Hide greeting message after first message
    if (greetingMessage) {
        console.log("Hiding greeting message");
        greetingMessage.style.display = 'none';
    } else {
        console.error("greetingMessage element not found!");
    }

    // Add user message with Markdown rendering
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

    // Animate search box wrapper to bottom
    if (searchBoxWrapper) {
        console.log("Adding 'bottom' class to searchBoxWrapper");
        searchBoxWrapper.classList.add('bottom');
    } else {
        console.error("searchBoxWrapper element not found!");
    }

    // Disable input and fade out send button while bot is replying
    isBotReplying = true;
    userInput.disabled = true;
    sendButton.classList.add('faded');

    // Add thinking skeleton animation
    const thinkingMessage = document.createElement('div');
    thinkingMessage.className = 'message bot thinking';
    thinkingMessage.id = 'thinking-message';
    thinkingMessage.innerHTML = `
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
    `;
    chatWindow.appendChild(thinkingMessage);

    // Scroll to bottom (latest message)
    scrollToBottom(chatWindow, true);

    // Clear input and reset search box height
    userInput.value = '';
    adjustSearchBoxHeight();

    // Prepare models based on mode and selected model
    let models = [];
    if (currentMode === 'Normal') {
        models = [mapModelToOpenRouter(currentModel)];
    } else if (currentMode === 'Pro') {
        models = [mapModelToOpenRouter(currentModel)];
    } else if (currentMode === 'Fun') {
        models = [mapModelToOpenRouter(currentModel)];
    }

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

        // Remove thinking skeleton
        const thinkingMsgElement = document.getElementById('thinking-message');
        if (thinkingMsgElement) {
            thinkingMsgElement.remove();
        }

        // Add actual bot reply with Markdown rendering
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

        // Scroll to bottom (latest message)
        scrollToBottom(chatWindow, true);

        // Fetch updated chat history
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

        // Scroll to bottom (latest message)
        scrollToBottom(chatWindow, true);

        // Fetch updated chat history
        updateChatHistory();
    } finally {
        // Re-enable input and restore send button color after bot reply
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
    
    // Hide greeting message when loading a chat
    if (greetingMessage) {
        console.log("Hiding greeting message in loadChat");
        greetingMessage.style.display = 'none';
    } else {
        console.error("greetingMessage element not found in loadChat!");
    }

    // Move search box to bottom
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

            // Reset alignment when loading a chat
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

// Function to start a new chat
async function startNewChat(event) {
    event.preventDefault(); // Prevent default link behavior
    const chatWindow = document.getElementById('chatWindow');
    const greetingMessage = document.getElementById('greetingMessage');
    const searchBoxWrapper = document.querySelector('.search-box-wrapper');
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.querySelector('.hamburger');
    const main = document.querySelector('main');

    // Clear chat window
    if (chatWindow) {
        chatWindow.innerHTML = '';
    } else {
        console.error("chatWindow element not found!");
        return;
    }

    // Show greeting message
    if (greetingMessage) {
        console.log("Showing greeting message");
        greetingMessage.style.display = 'block';
    } else {
        console.error("greetingMessage element not found!");
    }

    // Move search box to center
    if (searchBoxWrapper) {
        console.log("Moving search box to center");
        searchBoxWrapper.classList.remove('bottom');
    } else {
        console.error("searchBoxWrapper element not found!");
    }

    // Clear existing chat history on the backend
    try {
        console.log("Clearing chat history on backend...");
        const response = await fetch('/delete_history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error('Failed to clear chat history');
        }
        console.log("Chat history cleared successfully");
    } catch (error) {
        console.error("Error clearing chat history:", error);
    }

    // Generate new chat name
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
    currentChatName = `Chat_${timestamp}`;
    console.log("Generated new chat name:", currentChatName);

    // Notify backend to create a new chat history entry
    try {
        console.log("Notifying backend to start new chat...");
        const response = await fetch('/chat', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error('Failed to start new chat');
        }
        console.log("New chat started successfully");
    } catch (error) {
        console.error("Error notifying backend for new chat:", error);
    }

    // Update chat history
    console.log("Updating chat history...");
    await updateChatHistory();

    // Close sidebar
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

    // Reset alignment
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

// Function to auto-expand search box based on input content
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
    const padding = 24; // 2 * 12px (top and bottom padding of search-box)
    const newHeight = inputHeight + buttonRowHeight + padding;
    searchBox.style.height = `${newHeight}px`;
}

// Function to scroll chat window to bottom (latest message)
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

// Function to map selected model to OpenRouter model
function mapModelToOpenRouter(model) {
    const modelMap = {
        'ChatGPT': 'openai/gpt-4.1-nano',
        'Grok': 'x-ai/grok-3-mini-beta',
        'DeepSeek': 'deepseek/deepseek-chat',
        'Claude': 'anthropic/claude-3.5-sonnet',
        'MetaAI': 'meta-llama/llama-3-8b-instruct',
        'Gemini': 'meta-llama/llama-4-maverick:free'
    };
    return modelMap[model] || 'xai/grok'; // Default to Grok if model not found
}

// Allow sending message with Enter key and rocket button, and handle dropup menus
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded");

    // Elements
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

    // Set current chat name from server
    currentChatName = "{{ chat_name }}";

    // Load chat history on page load
    updateChatHistory();

    // Add scroll event listener to detect manual scrolling
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

    // User input event listeners
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

    // Send button event listener
    if (sendButton) {
        sendButton.addEventListener('click', () => {
            console.log("Send button clicked, calling sendMessage...");
            sendMessage();
        });
    } else {
        console.error("sendButton element not found!");
    }

    // New chat link event listener (sidebar)
    if (newChatLink) {
        newChatLink.addEventListener('click', (event) => {
            console.log("New Chat link (sidebar) clicked, starting new chat...");
            startNewChat(event);
        });
    } else {
        console.error("newChatLink element not found!");
    }

    // Toggle dropup menu for mode button
    if (modeButton && modeDropupContent) {
        modeButton.addEventListener('click', () => {
            console.log("Mode button clicked");
            const isVisible = modeDropupContent.style.display === 'block';
            modeDropupContent.style.display = isVisible ? 'none' : 'block';
        });

        // Handle mode selection
        modeOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const selectedMode = option.getAttribute('data-mode');
                currentMode = selectedMode;

                // Update button text
                modeButton.innerHTML = `${selectedMode} <i class="fas fa-chevron-up"></i>`;

                // Remove highlight from all options
                modeOptions.forEach(opt => opt.classList.remove('highlighted'));

                // Highlight the selected option
                option.classList.add('highlighted');

                // Close dropup menu
                modeDropupContent.style.display = 'none';
            });
        });

        // Close mode dropup menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!modeButton.contains(e.target) && !modeDropupContent.contains(e.target)) {
                modeDropupContent.style.display = 'none';
            }
        });
    } else {
        console.error("modeButton or modeDropupContent element not found!");
    }

    // Toggle dropup menu for model button
    if (modelButton && modelDropupContent) {
        modelButton.addEventListener('click', () => {
            console.log("Model button clicked");
            const isVisible = modelDropupContent.style.display === 'block';
            modelDropupContent.style.display = isVisible ? 'none' : 'block';
        });

        // Handle model selection
        modelOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const selectedModel = option.getAttribute('data-model');
                currentModel = selectedModel;

                // Add model switch notification to chat
                addModelSwitchNotification(chatWindow, currentModel);

                // Update button text
                modelButton.innerHTML = `${selectedModel} <i class="fas fa-chevron-up"></i>`;

                // Remove highlight from all options
                modelOptions.forEach(opt => opt.classList.remove('highlighted'));

                // Highlight the selected option
                option.classList.add('highlighted');

                // Close dropup menu
                modelDropupContent.style.display = 'none';
            });
        });

        // Close model dropup menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!modelButton.contains(e.target) && !modelDropupContent.contains(e.target)) {
                modelDropupContent.style.display = 'none';
            }
        });
    } else {
        console.error("modelButton or modelDropupContent element not found!");
    }

    // Hamburger menu toggle and left shift for laptop
    if (hamburger && sidebar && main && chatWindowElement && searchBoxWrapper) {
        console.log("Hamburger, sidebar, main, chatWindowElement, and searchBoxWrapper elements found, setting up toggle");
        hamburger.addEventListener('click', () => {
            console.log("Hamburger clicked, toggling sidebar");
            hamburger.classList.toggle('active');
            sidebar.classList.toggle('active');
            main.classList.toggle('sidebar-active');

            if (window.innerWidth >= 1025) {
                const shiftAmount = '300px'; // Match sidebar width
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

    // Ensure greeting message is visible on page load only if no chat history
    if (greetingMessage) {
        greetingMessage.style.display = 'block';
    }
});

// Handle page refresh to start a new chat
window.addEventListener('beforeunload', () => {
    // Clear current chat name to start a new chat on refresh
    sessionStorage.removeItem('currentChatName');
});
