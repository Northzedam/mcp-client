const OpenAI = require('openai');

class OpenAIClient {
  constructor(apiKey) {
    this.client = new OpenAI({ apiKey });
  }

  async streamChat({ sessionId, messages, model = 'gpt-4', opts = {} }) {
    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages,
        stream: true,
        ...opts
      });

      let fullResponse = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          // Emitir chunk por IPC
          global.mainWindow?.webContents?.send('chat:stream:delta', {
            sessionId,
            content,
            fullResponse
          });
        }
      }

      // Emitir finalización
      global.mainWindow?.webContents?.send('chat:stream:end', {
        sessionId,
        fullResponse
      });

      return fullResponse;
    } catch (error) {
      console.error('Error en OpenAI streaming:', error);
      global.mainWindow?.webContents?.send('chat:stream:error', {
        sessionId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = { OpenAIClient };
