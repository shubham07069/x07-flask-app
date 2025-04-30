* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Inter', sans-serif;
    background: linear-gradient(135deg, #0a0a0a, #1a0033);
    color: #e0e0e0;
    line-height: 1.6;
    overflow-x: hidden;
}

/* Landing Page Section */
.landing-page {
    position: relative;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    transition: opacity 0.5s ease-in-out;
    padding: 2rem;
}

.background-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: url('https://images.unsplash.com/photo-1618005198919-d3d4b5a9d3b7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1950&q=80') no-repeat center center/cover;
    z-index: 0;
    animation: zoomOut 5s ease-in-out forwards;
    filter: brightness(0.6);
}

.landing-page .overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 1;
}

.landing-page .content {
    position: relative;
    z-index: 2;
    text-align: center;
}

.landing-page h1 {
    font-family: 'Orbitron', sans-serif;
    font-size: 5rem;
    color: #00d4ff;
    text-shadow: 0 0 20px #00d4ff, 0 0 40px #7b00ff;
    animation: glow 2s infinite alternate;
    margin-bottom: 1rem;
}

.landing-page .tagline {
    font-family: 'Inter', sans-serif;
    font-size: 1.5rem;
    color: #e0e0e0;
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
    animation: fadeIn 1.5s ease-in;
    margin-bottom: 2rem;
}

.feature-container {
    display: flex;
    justify-content: center;
    gap: 2rem;
    margin-bottom: 3rem;
    flex-wrap: wrap;
}

.feature-card {
    width: 300px;
    background: rgba(26, 26, 26, 0.95);
    border-radius: 15px;
    border: 3px solid #00d4ff;
    overflow: hidden;
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
    transition: transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
    animation: slideIn 1s ease-in-out forwards;
    cursor: pointer;
    opacity: 0;
}

.feature-card.ai-chat {
    animation-delay: 0.2s;
}

.feature-card.forex-trading {
    animation-delay: 0.4s;
}

.feature-card.messaging-app {
    animation-delay: 0.6s;
}

.feature-card:hover {
    transform: scale(1.05) rotate(2deg);
    box-shadow: 0 0 40px rgba(0, 212, 255, 0.8), 0 0 60px rgba(123, 0, 255, 0.5);
}

.feature-card img {
    width: 100%;
    height: 200px;
    object-fit: cover;
    border-bottom: 3px solid #00d4ff;
}

.feature-card h3 {
    font-family: 'Orbitron', sans-serif;
    font-size: 1.8rem;
    color: #00d4ff;
    margin: 1rem 0 0.5rem;
    text-shadow: 0 0 10px #00d4ff;
}

.feature-card p {
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    color: #e0e0e0;
    padding: 0 1rem 1rem;
}

.auth-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
}

.auth-button {
    padding: 1rem 2rem;
    background: linear-gradient(90deg, #00d4ff, #7b00ff);
    border: none;
    border-radius: 15px;
    font-family: 'Orbitron', sans-serif;
    font-size: 1.2rem;
    color: #fff;
    text-decoration: none;
    cursor: pointer;
    box-shadow: 0 0 15px rgba(0, 212, 255, 0.7);
    transition: transform 0.2s, box-shadow 0.3s;
}

.auth-button:hover {
    transform: scale(1.1);
    box-shadow: 0 0 25px rgba(0, 212, 255, 0.9);
}

/* Auth Page (Login/Register) */
.auth-page {
    position: relative;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
}

.auth-container {
    position: relative;
    z-index: 2;
    text-align: center;
    background: rgba(26, 26, 26, 0.95);
    padding: 2rem;
    border-radius: 15px;
    border: 3px solid #00d4ff;
    box-shadow: 0 0 40px rgba(0, 212, 255, 0.5);
}

.auth-container h1 {
    font-family: 'Orbitron', sans-serif;
    font-size: 3rem;
    color: #00d4ff;
    text-shadow: 0 0 20px #00d4ff, 0 0 40px #7b00ff;
    margin-bottom: 1.5rem;
}

.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    font-family: 'Inter', sans-serif;
    font-size: 1.2rem;
    color: #e0e0e0;
    margin-bottom: 0.5rem;
}

.form-group input {
    width: 100%;
    padding: 0.8rem;
    border: 2px solid #00d4ff;
    border-radius: 10px;
    background: #2a2a2a;
    color: #e0e0e0;
    font-size: 1.1rem;
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
    transition: border-color 0.3s, box-shadow 0.3s;
}

.form-group input:focus {
    outline: none;
    border-color: #7b00ff;
    box-shadow: 0 0 15px rgba(123, 0, 255, 0.7);
}

.auth-container p {
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    color: #e0e0e0;
    margin-top: 1rem;
}

.auth-container a {
    color: #00d4ff;
    text-decoration: none;
    transition: color 0.3s;
}

.auth-container a:hover {
    color: #7b00ff;
}

.flash-success {
    background: rgba(0, 212, 255, 0.2);
    color: #00d4ff;
    padding: 0.5rem;
    border-radius: 5px;
    margin-bottom: 1rem;
}

.flash-error {
    background: rgba(255, 0, 0, 0.2);
    color: #ff5555;
    padding: 0.5rem;
    border-radius: 5px;
    margin-bottom: 1rem;
}

/* Chatbot Page Section */
.chatbot-page {
    background: #1a1a1a;
    position: relative;
    display: flex;
    min-height: 100vh;
}

.chatbot-page header {
    background: transparent;
    padding: 1rem 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
}

.chatbot-page .logo {
    font-family: 'Orbitron', sans-serif;
    font-size: 2.5rem;
    font-weight: 700;
    color: #fff;
}

.chatbot-page .hamburger {
    display: flex !important;
    flex-direction: column;
    gap: 5px;
    cursor: pointer;
    z-index: 15;
    order: -1;
}

.chatbot-page .hamburger span {
    width: 25px;
    height: 3px;
    background: #fff;
    border-radius: 2px;
    transition: all 0.3s;
}

.chatbot-page .hamburger.active span:nth-child(1) {
    transform: rotate(45deg) translate(5px, 5px);
}

.chatbot-page .hamburger.active span:nth-child(2) {
    opacity: 0;
}

.chatbot-page .hamburger.active span:nth-child(3) {
    transform: rotate(-45deg) translate(5px, -5px);
}

.sidebar {
    position: fixed;
    top: 0;
    left: -300px;
    width: 300px;
    height: 100%;
    background: rgba(26, 26, 26, 0.95);
    border-right: 3px solid #00d4ff;
    transition: left 0.3s ease-in-out;
    z-index: 5;
}

.sidebar.active {
    left: 0;
}

.nav-menu {
    padding: 5rem 1rem 1rem;
}

.nav-menu ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.nav-menu a {
    font-family: 'Orbitron', sans-serif;
    color: #fff;
    text-decoration: none;
    font-weight: 500;
    font-size: 1.2rem;
    transition: color 0.3s, text-shadow 0.3s;
}

.nav-menu a:hover {
    color: #00d4ff;
    text-shadow: 0 0 10px #00d4ff, 0 0 20px #00d4ff;
}

.divider {
    border: 1px solid #00d4ff;
    margin: 1rem 0;
}

.chat-history {
    padding: 1rem;
}

.chat-history h3 {
    font-family: 'Orbitron', sans-serif;
    font-size: 1.5rem;
    color: #00d4ff;
    margin-bottom: 1rem;
}

.chat-history ul {
    list-style: none;
}

.chat-history li {
    padding: 0.5rem;
    background: rgba(0, 212, 255, 0.1);
    border-radius: 5px;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: background 0.3s;
}

.chat-history li:hover {
    background: rgba(0, 212, 255, 0.3);
}

.chatbot-page main {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 5rem 1rem 1rem;
    transition: margin-left 0.3s ease-in-out;
    position: relative;
}

.chatbot-page main.sidebar-active {
    margin-left: 300px;
}

.chatbot-page .chat-container {
    width: 100%;
    max-width: 700px;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.chatbot-page .chat-window {
    width: 100%;
    max-width: 700px;
    height: calc(100vh - 12rem);
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap
