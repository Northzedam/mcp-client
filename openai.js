const OpenAI = require('openai');

class OpenAIClient {
  constructor(apiKey) {
    this.client = new OpenAI({ apiKey });
  }

  async streamChat({ sessionId, messages, model = 'gpt-4', opts = {}, tools = [], mcpAdapter = null, mcpToolsData = [] }) {
    try {
      const requestOptions = {
        model,
        messages,
        stream: true,
        ...opts
      };

      // Agregar herramientas si están disponibles
      if (tools && tools.length > 0) {
        console.log('OpenAI: Agregando herramientas a la solicitud:', tools.length);
        console.log('OpenAI: Nombres de herramientas:', tools.map(t => t.function?.name));
        requestOptions.tools = tools;
        requestOptions.tool_choice = 'auto';
      } else {
        console.log('OpenAI: No hay herramientas disponibles para agregar');
      }

      const stream = await this.client.chat.completions.create(requestOptions);

      let fullResponse = '';
      let toolCalls = [];
      
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const content = delta?.content || '';
        const toolCall = delta?.tool_calls;
        
        if (content) {
          fullResponse += content;
          // Emitir chunk por IPC
          global.mainWindow?.webContents?.send('chat:stream:delta', {
            sessionId,
            content,
            fullResponse
          });
        }
        
        if (toolCall) {
          console.log('OpenAI: Llamada a herramienta detectada:', toolCall);
          toolCalls.push(toolCall);
        }
      }

      // Si hay llamadas a herramientas, procesarlas
      if (toolCalls.length > 0 && mcpAdapter) {
        console.log('OpenAI: Procesando llamadas a herramientas:', toolCalls.length);
        await this.processToolCalls(sessionId, toolCalls, messages, mcpAdapter, mcpToolsData);
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

  async processToolCalls(sessionId, toolCalls, messages, mcpAdapter, mcpToolsData) {
    try {
      console.log('OpenAI: Procesando llamadas a herramientas:', toolCalls);
      
      const toolResults = [];
      
      // toolCalls es un array de arrays, necesitamos aplanarlo
      const flattenedToolCalls = toolCalls.flat();
      console.log('OpenAI: ToolCalls aplanados:', flattenedToolCalls.length);
      
      for (const toolCall of flattenedToolCalls) {
        console.log('OpenAI: Procesando toolCall:', JSON.stringify(toolCall, null, 2));
        
        const { id, function: functionCall } = toolCall;
        
        if (!functionCall) {
          console.log('OpenAI: Saltando toolCall sin function:', toolCall);
          continue;
        }
        
        const { name, arguments: args } = functionCall;
        
        console.log('OpenAI: Ejecutando herramienta:', name, 'con args:', args);
        
        try {
          // Parsear argumentos de forma segura
          let parsedArgs = {};
          if (args && args.trim()) {
            try {
              parsedArgs = JSON.parse(args);
            } catch (parseError) {
              console.log('OpenAI: Error parseando args, usando objeto vacío:', parseError.message);
              parsedArgs = {};
            }
          }
          
          // Ejecutar la herramienta MCP
          const result = await mcpAdapter.callTool(name, parsedArgs, sessionId, mcpToolsData);
          
          toolResults.push({
            tool_call_id: id,
            role: 'tool',
            name: name,
            content: JSON.stringify(result)
          });
          
          console.log('OpenAI: Herramienta ejecutada exitosamente:', name);
        } catch (error) {
          console.error('OpenAI: Error ejecutando herramienta:', name, error);
          toolResults.push({
            tool_call_id: id,
            role: 'tool',
            name: name,
            content: JSON.stringify({ error: error.message })
          });
        }
      }
      
      // Agregar resultados de herramientas a los mensajes
      const updatedMessages = [...messages, ...toolResults];
      
      // Continuar la conversación con los resultados
      await this.streamChat({
        sessionId,
        messages: updatedMessages,
        model: 'gpt-4',
        opts: {},
        tools: [], // No pasar herramientas en la segunda llamada para evitar loops
        mcpAdapter: null, // No pasar mcpAdapter en la segunda llamada
        mcpToolsData: [] // No pasar mcpToolsData en la segunda llamada
      });
      
    } catch (error) {
      console.error('OpenAI: Error procesando llamadas a herramientas:', error);
      global.mainWindow?.webContents?.send('chat:stream:error', {
        sessionId,
        error: error.message
      });
    }
  }
}

module.exports = { OpenAIClient };
