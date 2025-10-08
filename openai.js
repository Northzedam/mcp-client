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
        
        // Agregar mensaje del sistema para indicar que debe usar herramientas
        const systemMessage = {
          role: 'system',
          content: `Eres un asistente con acceso a herramientas del sistema. Cuando el usuario te pida realizar acciones como listar archivos, leer archivos, navegar por el navegador, etc., DEBES usar las herramientas disponibles. No digas que no puedes hacerlo - usa las herramientas para completar las tareas solicitadas.

IMPORTANTE: Para operaciones de archivos, usa estas rutas exactas:
- Para el Desktop del usuario: "C:\\Users\\Luci4n0\\Desktop"
- Para documentos del usuario: "C:\\Users\\Luci4n0\\Documents"

NO uses rutas como "/Desktop" o "~/Desktop" - usa las rutas completas de Windows.

Herramientas disponibles: ${tools.map(t => t.function?.name).join(', ')}`
        };
        
        // Insertar mensaje del sistema al principio
        requestOptions.messages = [systemMessage, ...messages];
      } else {
        console.log('OpenAI: No hay herramientas disponibles para agregar');
      }

      const stream = await this.client.chat.completions.create(requestOptions);

        let fullResponse = '';
        let toolCalls = [];
        let currentToolCall = null;
        
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
            
            // Si es el inicio de una nueva tool call
            if (toolCall[0]?.index !== undefined && toolCall[0]?.id) {
              currentToolCall = {
                id: toolCall[0].id,
                type: toolCall[0].type,
                function: {
                  name: toolCall[0].function?.name || '',
                  arguments: toolCall[0].function?.arguments || ''
                }
              };
              toolCalls.push(currentToolCall);
            }
            // Si es continuación de argumentos
            else if (currentToolCall && toolCall[0]?.function?.arguments) {
              currentToolCall.function.arguments += toolCall[0].function.arguments;
            }
          }
        }

        // Si hay llamadas a herramientas, procesarlas
        if (toolCalls.length > 0 && mcpAdapter) {
          console.log('OpenAI: Procesando llamadas a herramientas:', toolCalls.length);
          try {
            await this.processToolCalls(sessionId, toolCalls, messages, mcpAdapter, mcpToolsData);
            console.log('OpenAI: Procesamiento de herramientas completado');
          } catch (error) {
            console.error('OpenAI: Error en procesamiento de herramientas:', error);
            global.mainWindow?.webContents?.send('chat:stream:error', {
              sessionId,
              error: error.message
            });
          }
          return fullResponse; // processToolCalls ya envía la respuesta final
        }

        // Emitir finalización solo si no hay herramientas
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
      
        console.log('OpenAI: ToolCalls procesados:', toolCalls.length);
        
        for (const toolCall of toolCalls) {
        console.log('OpenAI: Procesando toolCall:', JSON.stringify(toolCall, null, 2));
        
        const { id, function: functionCall } = toolCall;
        
        if (!functionCall) {
          console.log('OpenAI: Saltando toolCall sin function:', toolCall);
          continue;
        }
        
        const { name, arguments: args } = functionCall;
        
        if (!name) {
          console.log('OpenAI: Saltando toolCall sin name:', functionCall);
          continue;
        }
        
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
      
      // Enviar resultados de herramientas al frontend
      console.log('OpenAI: toolResults.length:', toolResults.length);
      console.log('OpenAI: toolResults:', JSON.stringify(toolResults, null, 2));
      if (toolResults.length > 0) {
        // Crear respuesta del agente con los resultados
        let agentResponse = `He ejecutado las siguientes herramientas:\n\n`;
        
        for (const toolResult of toolResults) {
          agentResponse += `**${toolResult.name}**:\n`;
          try {
            const result = JSON.parse(toolResult.content);
            if (result.success) {
              agentResponse += `✅ Ejecutado exitosamente\n`;
              if (result.result && result.result.content) {
                // Si el resultado tiene contenido del MCP, mostrarlo directamente
                const content = result.result.content;
                if (Array.isArray(content)) {
                  content.forEach(item => {
                    if (item.type === 'text') {
                      agentResponse += `${item.text}\n`;
                    }
                  });
                } else {
                  agentResponse += `${JSON.stringify(result.result, null, 2)}\n`;
                }
              } else if (result.result) {
                agentResponse += `Resultado: ${JSON.stringify(result.result, null, 2)}\n`;
              }
              agentResponse += `\n`;
            } else {
              agentResponse += `❌ Error: ${result.error}\n\n`;
            }
          } catch (e) {
            agentResponse += `Resultado: ${toolResult.content}\n\n`;
          }
        }
        
        // Enviar respuesta final como mensaje del agente
        console.log('OpenAI: Enviando respuesta al frontend:', agentResponse);
        global.mainWindow?.webContents?.send('chat:stream:end', {
          sessionId,
          fullResponse: agentResponse
        });
      }
      
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
