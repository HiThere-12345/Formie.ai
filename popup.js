document.getElementById('startChat').addEventListener('click', showChat);

function showChat() {
  document.getElementById('chat').removeAttribute("hidden");
  document.getElementById('send-button').removeAttribute("hidden");
  document.getElementById('startChat').setAttribute("hidden", true);
  summary = "Create a simplified summary of the page content. Mention the key points and the main idea of the page."
  converse(summary);
}

document.getElementById('fillButton').addEventListener('click', () => {
  converse("List all the possible input fields in the form in the order they appear in")
  converse("Resume First Name: John, Last Name: Doe, Email: jd@aa.a, Phone: 123-456-7890, Address: 123 Main St, City: New York, State: NY, Zip: 12345")
  for (let i = 1; i < 12; i++) {
    converse("Use a single line to instruct me on how to fill out ONLY the " + i + "th input field in the form using the information on my resume(if possible).  Use the format of the following example: Fill out the (number) input field in the code with your _");
  }
});

document.getElementById('send-button').addEventListener('click', () => {converse(document.getElementById('user-input').value, true)});

function converse(userInput, display = false) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0].url;
    if (url.startsWith('chrome://')) {
      console.error('Cannot interact with chrome:// URLs');
      return;
    }
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ['content.js']
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.error('Script injection failed: ' + chrome.runtime.lastError.message);
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getTextContent' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message sending failed: ' + chrome.runtime.lastError.message);
          return;
        }
        if (response && response.text) {
          const textContent = response.text;
          console.log(response.text);
          if (display){
            addMessage('User', userInput);
          }
          getChatGPTResponse(userInput, textContent);
          document.getElementById('user-input').value = '';
        } else {
          console.error('Failed to retrieve text content or response is undefined');
        }
      });
    });
  });
}

function addMessage(sender, message) {
  const chatbox = document.getElementById('chatbox');
  const messageElement = document.createElement('div');
  messageElement.textContent = `${sender}: ${message}`;
  messageElement.style.fontSize = '16px';
  chatbox.appendChild(messageElement);
  chatbox.scrollTop = chatbox.scrollHeight;
}

async function getChatGPTResponse(userInput, textContent) {
  let retries = 5;
  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  while (retries > 0) {
    try {
      console.log('Sending request to OpenAI:', { userInput, textContent });
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer '
        },
        body: JSON.stringify({
          model: 'chatgpt-4o-latest',
          messages: [
            { role: 'system', content: 'You are an assistant that processes web page content.' },
            { role: 'user', content: `User input: ${userInput}` },
            { role: 'user', content: `Page text content: ${textContent}` }
          ],
          max_tokens: 150,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('Rate limited. Retrying in ' + (1000 * Math.pow(2, 5 - retries)) + 'ms');
          retries -= 1;
          await delay(1000 * Math.pow(2, 5 - retries));
          continue;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('API Response:', data);

      if (data.choices && data.choices.length > 0) {
        const chatGPTMessage = data.choices[0].message.content.trim();
        addMessage('ChatGPT', chatGPTMessage);
      } else {
        addMessage('ChatGPT', 'Sorry, I did not understand that.');
      }
      break;
    } catch (error) {
      console.error('Error fetching ChatGPT response:', error);
      addMessage('ChatGPT', 'Sorry, something went wrong.');
      break;
    }
  }
}