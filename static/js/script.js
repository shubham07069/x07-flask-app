// Get DOM elements
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

// Send message when button clicked
sendBtn.addEventListener("click", sendMessage);

// Send message when Enter key is pressed
userInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    sendMessage();
  }
});

// Function to send message
function sendMessage() {
  const message = userInput.value.trim();
  if (message === "") return;

  displayMessage(message, "user");
  userInput.value = "";

  fetch("http://localhost:5004/chat/telegram", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: message }),
  })
    .then((res) => res.json())
    .then((data) => {
      const botReply = data.message || "Bot didn't reply properly.";
      displayMessage(botReply, "bot");
    })
    .catch((err) => {
      console.error("Error:", err);
      displayMessage("Error: Could not get reply from bot.", "bot");
    });
}

// Function to display message
function displayMessage(message, sender) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", sender);
  messageElement.innerText = message;
  chatWindow.appendChild(messageElement);
  scrollToBottomSmooth(); // 🔥 Smart auto-scroll call
}

// Smart scroll only if user is at bottom
function scrollToBottomSmooth() {
  const isAtBottom =
    chatWindow.scrollHeight - chatWindow.clientHeight - chatWindow.scrollTop < 100;

  if (isAtBottom) {
    chatWindow.scrollTo({
      top: chatWindow.scrollHeight,
      behavior: "smooth",
    });
  }
}
