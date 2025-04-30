let chatHistory = JSON.parse(localStorage.getItem('chatHistory')) || []; // Load chat history from localStorage
let currentMode = 'Normal'; // Default mode
let currentModel = 'default'; // Default model
let latestConversationHeight = 0; // To store height of latest conversation
let isUserScrolling = false; // Flag to track if user is manually scrolling
let isBotReplying = false; // Flag to track if bot is replying

// Function to render Markdown-like text (bold and emojis)
function renderMessageText(text) {
    // Replace **text** with <strong>text</strong> for bold
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

    // Prepare models and custom instructions based on mode
    let models = [];
    let customInstructions = [];
    if (currentMode === 'Normal') {
        models = ['default'];
        customInstructions = [''];
    } else if (currentMode === 'Pro') {
        models = ['meta-llama/llama-4-scout:free'];
        customInstructions = ['Yeh bahut powerful AI hai'];
    } else if (currentMode === 'Fun') {
        models = ['google/gemini-2.5-flash-preview'];
        customInstructions = ['Yeh bahut gaali dene wala AI jo gaali mein baat karta hai with roasting'];
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
                models: models,
                customInstructions: customInstructions
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

        // Add to chat history
        chatHistory.push({ user: inputValue, bot: data.reply });
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory)); // Save to localStorage
        updateChatHistory();

        // Scroll to bottom (latest message)
        scrollToBottom(chatWindow, true);
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

        // Add to chat history even if there's an error
        chatHistory.push({ user: inputValue, bot: `Bhosdike, kuch galat ho gaya! 😅 Error: ${error.message}` });
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory)); // Save to localStorage
        updateChatHistory();

        // Scroll to bottom (latest message)
        scrollToBottom(chatWindow, true);
    } finally {
        // Re-enable input and restore send button color after bot reply
        isBotReplying = false;
        userInput.disabled = false;
        sendButton.classList.remove('faded');
    }
}

function updateChatHistory() {
    const chatHistoryList = document.getElementById('chatHistoryList');
    if (chatHistoryList) {
        chatHistoryList.innerHTML = '';
        chatHistory.forEach((chat, index) => {
            const li = document.createElement('li');
            li.textContent = `Chat ${index + 1}: ${chat.user.substring(0, 20)}...`;
            li.onclick = () => loadChat(index);
            chatHistoryList.appendChild(li);
        });
    } else {
        console.error("chatHistoryList element not found!");
    }
}

function loadChat(index) {
    const chatWindow = document.getElementById('chatWindow');
    const greetingMessage = document.getElementById('greetingMessage');
    
    // Hide greeting message when loading a chat
    if (greetingMessage) {
        console.log("Hiding greeting message in loadChat");
        greetingMessage.style.display = 'none';
    } else {
        console.error("greetingMessage element not found in loadChat!");
    }

    chatWindow.innerHTML = '';
    const chat = chatHistory[index];
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
        // Get the last two messages (user + bot reply)
        const messages = chatWindow.getElementsByClassName('message');
        if (messages.length >= 2) {
            const latestUserMessage = messages[messages.length - 2];
            const latestBotMessage = messages[messages.length - 1];
            const latestConversationHeight = latestUserMessage.offsetHeight + latestBotMessage.offsetHeight + 48; // 1.5rem gap between messages + padding

            // Scroll to the position where the latest conversation starts
            chatWindow.scrollTo({
                top: chatWindow.scrollHeight - latestConversationHeight,
                behavior: 'smooth'
            });

            // Update the chat window height to fit the latest conversation
            chatWindow.style.height = `${Math.min(latestConversationHeight, chatWindow.scrollHeight)}px`;
        } else {
            // If less than 2 messages, scroll to bottom normally
            chatWindow.scrollTo({
                top: chatWindow.scrollHeight,
                behavior: 'smooth'
            });
            chatWindow.style.height = 'auto';
        }
    } else {
        // Normal scroll to bottom (used in loadChat)
        chatWindow.scrollTo({
            top: chatWindow.scrollHeight,
            behavior: 'smooth'
        });
        chatWindow.style.height = 'auto';
    }
}

// Allow sending message with Enter key and rocket button, and handle dropup menu
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded");

    // Elements
    const userInput = document.getElementById('userInput');
    const modeButton = document.querySelector('.mode-button');
    const dropupContent = document.querySelector('.dropup-content');
    const modeOptions = document.querySelectorAll('.mode-option');
    const greetingMessage = document.getElementById('greetingMessage');
    const chatWindow = document.getElementById('chatWindow');
    const hamburger = document.querySelector('.hamburger');
    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('main');
    const chatWindowElement = document.querySelector('.chat-window');
    const searchBoxWrapper = document.querySelector('.search-box-wrapper');

    // Load chat history on page load
    if (chatHistory.length > 0) {
        chatWindow.innerHTML = '';
        // Display all messages in chronological order (oldest at top, latest at bottom)
        for (let i = 0; i < chatHistory.length; i++) {
            const chat = chatHistory[i];
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
        }
        scrollToBottom(chatWindow, true);
    }

    // Add scroll event listener to detect manual scrolling
    if (chatWindow) {
        chatWindow.addEventListener('scroll', () => {
            // Check if user is scrolling up
            const isAtBottom = chatWindow.scrollHeight - chatWindow.scrollTop <= chatWindow.clientHeight + 1;
            isUserScrolling = !isAtBottom; // Set flag to true if user is not at the bottom
        });

        // Add mutation observer to auto-scroll when new messages are added
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(() => {
                if (!isUserScrolling) {
                    scrollToBottom(chatWindow, true);
                }
            });
        });

        // Observe changes to the chat window (new messages)
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

        // Auto-expand search box on input
        userInput.addEventListener('input', adjustSearchBoxHeight);
        // Initial adjustment
        adjustSearchBoxHeight();
    } else {
        console.error("userInput element not found!");
    }

    // Toggle dropup menu for mode button
    if (modeButton && dropupContent) {
        modeButton.addEventListener('click', () => {
            console.log("Mode button clicked");
            const isVisible = dropupContent.style.display === 'block';
            dropupContent.style.display = isVisible ? 'none' : 'block';
        });

        // Handle mode selection
        modeOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const selectedMode = option.getAttribute('data-mode');
                currentMode = selectedMode;

                // Update current model based on mode
                if (currentMode === 'Normal') {
                    currentModel = 'default';
                } else if (currentMode === 'Pro') {
                    currentModel = 'meta-llama/llama-4-scout:free';
                } else if (currentMode === 'Fun') {
                    currentModel = 'google/gemini-2.5-flash-preview';
                }

                // Add model switch notification to chat
                addModelSwitchNotification(chatWindow, currentModel);

                // Update button text
                modeButton.innerHTML = `${selectedMode} <i class="fas fa-chevron-up"></i>`;

                // Remove highlight from all options
                modeOptions.forEach(opt => opt.classList.remove('highlighted'));

                // Highlight the selected option
                option.classList.add('highlighted');

                // Close dropup menu
                dropupContent.style.display = 'none';
            });
        });

        // Close dropup menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!modeButton.contains(e.target) && !dropupContent.contains(e.target)) {
                dropupContent.style.display = 'none';
            }
        });
    } else {
        console.error("modeButton or dropupContent element not found!");
    }

    // Hamburger menu toggle and left shift for laptop
    if (hamburger && sidebar && main && chatWindowElement && searchBoxWrapper) {
        console.log("Hamburger, sidebar, main, chatWindowElement, and searchBoxWrapper elements found, setting up toggle");
        hamburger.addEventListener('click', () => {
            console.log("Hamburger clicked, toggling sidebar");
            hamburger.classList.toggle('active');
            sidebar.classList.toggle('active');
            main.classList.toggle('sidebar-active');

            // Left shift for laptop only, sync with search box
            if (window.innerWidth >= 1025) {
                const shiftAmount = '150px';
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
        console.log("hamburger:", hamburger);
        console.log("sidebar:", sidebar);
        console.log("main:", main);
        console.log("chatWindowElement:", chatWindowElement);
        console.log("searchBoxWrapper:", searchBoxWrapper);
    }

    // Ensure greeting message is visible on page load only if chat history is empty
    if (greetingMessage) {
        if (chatHistory.length === 0) {
            greetingMessage.style.display = 'block';
        } else {
            greetingMessage.style.display = 'none';
        }
    }
});
