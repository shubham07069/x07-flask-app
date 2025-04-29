let chatHistory = [];
let currentMode = 'Normal'; // Default mode

async function sendMessage() {
    const userInput = document.getElementById('userInput').value;
    if (!userInput.trim()) {
        console.log("Input is empty, skipping send.");
        return;
    }

    const chatWindow = document.getElementById('chatWindow');
    const greetingMessage = document.querySelector('.greeting-message');
    const searchBoxWrapper = document.querySelector('.search-box-wrapper');

    // Hide greeting message after first message
    if (greetingMessage) {
        greetingMessage.style.display = 'none';
    }

    // Add user message
    const userMessage = document.createElement('div');
    userMessage.className = 'message user';
    userMessage.innerHTML = `
        <div class="message-content">${userInput}</div>
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
    searchBoxWrapper.classList.add('bottom');

    // Add thinking skeleton animation
    const thinkingMessage = document.createElement('div');
    thinkingMessage.className = 'message bot thinking';
    thinkingMessage.id = 'thinking-message';
    thinkingMessage.innerHTML = `
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
    `;
    chatWindow.appendChild(thinkingMessage);

    // Scroll to bottom with smooth behavior
    chatWindow.scrollTop = chatWindow.scrollHeight;

    // Clear input
    document.getElementById('userInput').value = '';

    try {
        console.log("Sending request to /ask endpoint with mode:", currentMode);
        const response = await fetch('/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: userInput, mode: currentMode }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Received response:", data);

        // Remove thinking skeleton
        const thinkingMsgElement = document.getElementById('thinking-message');
        if (thinkingMsgElement) {
            thinkingMsgElement.remove();
        }

        // Add actual bot reply
        const aiMessage = document.createElement('div');
        aiMessage.className = 'message bot';
        aiMessage.innerHTML = `
            <div class="message-content">${data.reply}</div>
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
        chatHistory.push({ user: userInput, bot: data.reply });
        updateChatHistory();

        // Scroll to bottom with smooth behavior
        chatWindow.scrollTop = chatWindow.scrollHeight;
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

        // Scroll to bottom with smooth behavior
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}

function updateChatHistory() {
    const chatHistoryList = document.getElementById('chatHistoryList');
    chatHistoryList.innerHTML = '';
    chatHistory.forEach((chat, index) => {
        const li = document.createElement('li');
        li.textContent = `Chat ${index + 1}: ${chat.user.substring(0, 20)}...`;
        li.onclick = () => loadChat(index);
        chatHistoryList.appendChild(li);
    });
}

function loadChat(index) {
    const chatWindow = document.getElementById('chatWindow');
    chatWindow.innerHTML = '';
    const chat = chatHistory[index];
    const userMessage = document.createElement('div');
    userMessage.className = 'message user';
    userMessage.innerHTML = `
        <div class="message-content">${chat.user}</div>
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
        <div class="message-content">${chat.bot}</div>
        <div class="message-actions">
            <i class="fas fa-copy action-icon"></i>
            <i class="fas fa-thumbs-up action-icon"></i>
            <i class="fas fa-thumbs-down action-icon"></i>
            <i class="fas fa-share action-icon"></i>
            <i class="fas fa-comment action-icon"></i>
        </div>
    `;
    chatWindow.appendChild(botMessage);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('active');
    const hamburger = document.querySelector('.hamburger');
    hamburger.classList.remove('active');
    const main = document.querySelector('main');
    main.classList.remove('sidebar-active');
}

// Allow sending message with Enter key and rocket button, and handle dropup menu
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded");
    const userInput = document.getElementById('userInput');
    const modeButton = document.querySelector('.mode-button');
    const dropupContent = document.querySelector('.dropup-content');
    const modeOptions = document.querySelectorAll('.mode-option');

    if (userInput) {
        userInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                console.log("Enter key pressed, calling sendMessage...");
                sendMessage();
            }
        });
    } else {
        console.error("userInput element not found!");
    }

    // Toggle dropup menu
    if (modeButton) {
        modeButton.addEventListener('click', () => {
            const isVisible = dropupContent.style.display === 'block';
            dropupContent.style.display = isVisible ? 'none' : 'block';
        });
    }

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
            dropupContent.style.display = 'none';
        });
    });

    // Close dropup menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!modeButton.contains(e.target) && !dropupContent.contains(e.target)) {
            dropupContent.style.display = 'none';
        }
    });

    // Hamburger menu toggle and left shift for laptop
    const hamburger = document.querySelector('.hamburger');
    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('main');
    const chatWindow = document.querySelector('.chat-window');
    const greetingMessage = document.querySelector('.greeting-message');
    const searchBoxWrapper = document.querySelector('.search-box-wrapper');

    if (hamburger && sidebar && main) {
        console.log("Hamburger, sidebar, and main elements found, setting up toggle");
        hamburger.addEventListener('click', () => {
            console.log("Hamburger clicked, toggling sidebar");
            hamburger.classList.toggle('active');
            sidebar.classList.toggle('active');
            main.classList.toggle('sidebar-active');

            // Left shift for laptop only, sync with search box
            if (window.innerWidth >= 1025) {
                const shiftAmount = '150px'; // Reduced shift to sync with search box
                if (main.classList.contains('sidebar-active')) {
                    chatWindow.style.marginLeft = shiftAmount;
                    if (greetingMessage) greetingMessage.style.marginLeft = shiftAmount;
                    searchBoxWrapper.style.marginLeft = shiftAmount;
                } else {
                    chatWindow.style.marginLeft = '0';
                    if (greetingMessage) greetingMessage.style.marginLeft = '0';
                    searchBoxWrapper.style.marginLeft = '0';
                }
            }
        });
    } else {
        console.error("Hamburger, sidebar, or main element not found!");
        console.log("hamburger:", hamburger);
        console.log("sidebar:", sidebar);
        console.log("main:", main);
    }
});
