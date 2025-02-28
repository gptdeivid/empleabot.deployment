"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./chat.module.css";
import { AssistantStream } from "openai/lib/AssistantStream";
// @ts-expect-error - no types for this yet
import { AssistantStreamEvent } from "openai/resources/beta/assistants/assistants";
import { RequiredActionFunctionToolCall } from "openai/resources/beta/threads/runs/runs";
import { extractPdfContent } from "../utils/pdfUtils";
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MessageProps = {
  role: "user" | "assistant" | "code";
  text: string;
};

const UserMessage = ({ text }: { text: string }) => {
  return (
    <div className={`${styles.messageWrapper} ${styles.userMessageWrapper}`}>
      <div className={`${styles.avatar} ${styles.userAvatar}`}>
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="white"/>
        </svg>
      </div>
      <div className={styles.userMessage}>
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          className={styles.markdown}
        >
          {text}
        </ReactMarkdown>
      </div>
    </div>
  );
};

const AssistantMessage = ({ text }: { text: string }) => {
  const [formattedContent, setFormattedContent] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const contentRef = useRef(text);

  useEffect(() => {
    contentRef.current = text;
    
    // Usar un debounce para esperar a que el texto se complete
    const timeoutId = setTimeout(() => {
      setFormattedContent(text);
      setIsComplete(true);
    }, 100); // Ajustar este valor según sea necesario

    return () => clearTimeout(timeoutId);
  }, [text]);

  return (
    <div className={`${styles.messageWrapper} ${styles.assistantMessageWrapper}`}>
      <div className={styles.avatar}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L4 5V11.09C4 16.14 7.41 20.85 12 22C16.59 20.85 20 16.14 20 11.09V5L12 2ZM14 15H10V13H14V15ZM14 11H10V9H14V11Z" fill="#4A5D4B"/>
        </svg>
      </div>
      <div className={styles.assistantMessage}>
        {!isComplete ? (
          // Mientras se está escribiendo, mostrar el texto sin formato
          <div className={`${styles.markdown} ${styles.streaming}`}>
            {text}
          </div>
        ) : (
          // Una vez completado, mostrar con formato Markdown
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            className={styles.markdown}
            components={{
              h1: ({node, ...props}) => <h1 className={styles.markdownH1} {...props} />,
              h2: ({node, ...props}) => <h2 className={styles.markdownH2} {...props} />,
              h3: ({node, ...props}) => <h3 className={styles.markdownH3} {...props} />,
              p: ({node, ...props}) => <p className={styles.markdownP} {...props} />,
              ul: ({node, ...props}) => <ul className={styles.markdownUl} {...props} />,
              ol: ({node, ...props}) => <ol className={styles.markdownOl} {...props} />,
              li: ({node, ...props}) => <li className={styles.markdownLi} {...props} />,
              code: ({inline, className, children, ...props}: {
                inline?: boolean;
                className?: string;
                children: React.ReactNode;
              }) => 
                inline ? 
                  <code className={styles.markdownInlineCode} {...props}>{children}</code> :
                  <div className={styles.markdownCodeBlock}>
                    <code {...props}>{children}</code>
                  </div>,
              pre: ({node, ...props}) => <pre className={styles.markdownPre} {...props} />,
              strong: ({node, ...props}) => <strong className={styles.markdownStrong} {...props} />,
              em: ({node, ...props}) => <em className={styles.markdownEm} {...props} />,
              blockquote: ({node, ...props}) => <blockquote className={styles.markdownBlockquote} {...props} />,
              a: ({node, ...props}) => <a className={styles.markdownLink} {...props} target="_blank" rel="noopener noreferrer" />
            }}
          >
            {formattedContent}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
};

const CodeMessage = ({ text }: { text: string }) => {
  return (
    <div className={styles.codeMessage}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className={styles.markdown}
        components={{
          code: ({inline, className, children, ...props}: {
            inline?: boolean;
            className?: string;
            children: React.ReactNode;
          }) => 
            <div className={styles.markdownCodeBlock}>
              <code {...props}>{children}</code>
            </div>,
          pre: ({node, ...props}) => <pre className={styles.markdownPre} {...props} />
        }}
      >
        {"```\n" + text + "\n```"}
      </ReactMarkdown>
    </div>
  );
};

const Message = ({ role, text }: MessageProps) => {
  switch (role) {
    case "user":
      return <UserMessage text={text} />;
    case "assistant":
      return <AssistantMessage text={text} />;
    case "code":
      return <CodeMessage text={text} />;
    default:
      return null;
  }
};

type ChatProps = {
  functionCallHandler?: (
    toolCall: RequiredActionFunctionToolCall
  ) => Promise<string>;
};

const Chat = ({
  functionCallHandler = () => Promise.resolve(""), // default to return empty string
}: ChatProps) => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [threadId, setThreadId] = useState("");
  const [selectedPdf, setSelectedPdf] = useState<{ name: string; content: string } | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // create a new threadID when chat component created
  useEffect(() => {
    const createThread = async () => {
      const res = await fetch(`/api/assistants/threads`, {
        method: "POST",
      });
      const data = await res.json();
      setThreadId(data.threadId);
    };
    createThread();
  }, []);

  const sendMessage = async (text) => {
    const response = await fetch(
      `/api/assistants/threads/${threadId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          content: text,
        }),
      }
    );
    const stream = AssistantStream.fromReadableStream(response.body);
    handleReadableStream(stream);
  };

  const submitActionResult = async (runId, toolCallOutputs) => {
    const response = await fetch(
      `/api/assistants/threads/${threadId}/actions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          runId: runId,
          toolCallOutputs: toolCallOutputs,
        }),
      }
    );
    const stream = AssistantStream.fromReadableStream(response.body);
    handleReadableStream(stream);
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setPdfError('Please select a PDF file');
      return;
    }

    try {
      setIsProcessingPdf(true);
      setPdfError(null);
      setUploadedFileName(file.name);
      
      const { text, name } = await extractPdfContent(file);
      setSelectedPdf({ name, content: text });
    } catch (error) {
      console.error('Error processing PDF:', error);
      setPdfError('Failed to process PDF. Please try again.');
      setSelectedPdf(null);
      setUploadedFileName(null);
    } finally {
      setIsProcessingPdf(false);
      event.target.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    
    // Combine PDF content with user input if PDF is selected
    const messageContent = selectedPdf 
      ? `PDF Content from ${selectedPdf.name}:\n${selectedPdf.content}\n\nUser Query: ${userInput}`
      : userInput;
    
    sendMessage(messageContent);
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", text: userInput },
    ]);
    setUserInput("");
    setInputDisabled(true);
    setSelectedPdf(null);
    setUploadedFileName(null); // Clear the file name after sending
    scrollToBottom();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setUserInput(suggestion);
    // Use setTimeout to ensure the state is updated before submitting
    setTimeout(() => {
      // Combine PDF content with suggestion if PDF is selected
      const messageContent = selectedPdf 
        ? `PDF Content from ${selectedPdf.name}:\n${selectedPdf.content}\n\nUser Query: ${suggestion}`
        : suggestion;
      
      sendMessage(messageContent);
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "user", text: suggestion },
      ]);
      setInputDisabled(true);
      setSelectedPdf(null);
      setUploadedFileName(null);
    }, 0);
  };

  /* Stream Event Handlers */

  // textCreated - create new assistant message
  const handleTextCreated = () => {
    appendMessage("assistant", "");
  };

  // textDelta - append text to last assistant message
  const handleTextDelta = (delta) => {
    if (delta.value != null) {
      appendToLastMessage(delta.value);
    };
    if (delta.annotations != null) {
      annotateLastMessage(delta.annotations);
    }
  };

  // imageFileDone - show image in chat
  const handleImageFileDone = (image) => {
    appendToLastMessage(`\n![${image.file_id}](/api/files/${image.file_id})\n`);
  }

  // toolCallCreated - log new tool call
  const toolCallCreated = (toolCall) => {
    if (toolCall.type != "code_interpreter") return;
    appendMessage("code", "");
  };

  // toolCallDelta - log delta and snapshot for the tool call
  const toolCallDelta = (delta, snapshot) => {
    if (delta.type != "code_interpreter") return;
    if (!delta.code_interpreter.input) return;
    appendToLastMessage(delta.code_interpreter.input);
  };

  // handleRequiresAction - handle function call
  const handleRequiresAction = async (
    event: AssistantStreamEvent.ThreadRunRequiresAction
  ) => {
    const runId = event.data.id;
    const toolCalls = event.data.required_action.submit_tool_outputs.tool_calls;
    // loop over tool calls and call function handler
    const toolCallOutputs = await Promise.all(
      toolCalls.map(async (toolCall) => {
        const result = await functionCallHandler(toolCall);
        return { output: result, tool_call_id: toolCall.id };
      })
    );
    setInputDisabled(true);
    submitActionResult(runId, toolCallOutputs);
  };

  // handleRunCompleted - re-enable the input form
  const handleRunCompleted = () => {
    setInputDisabled(false);
  };

  const handleReadableStream = (stream: AssistantStream) => {
    // messages
    stream.on("textCreated", handleTextCreated);
    stream.on("textDelta", handleTextDelta);

    // image
    stream.on("imageFileDone", handleImageFileDone);

    // code interpreter
    stream.on("toolCallCreated", toolCallCreated);
    stream.on("toolCallDelta", toolCallDelta);

    // events without helpers yet (e.g. requires_action and run.done)
    stream.on("event", (event) => {
      if (event.event === "thread.run.requires_action")
        handleRequiresAction(event);
      if (event.event === "thread.run.completed") handleRunCompleted();
    });
  };

  /*
    =======================
    === Utility Helpers ===
    =======================
  */

  const appendToLastMessage = (text) => {
    setMessages((prevMessages) => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      const updatedLastMessage = {
        ...lastMessage,
        text: lastMessage.text + text,
      };
      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
  };

  const appendMessage = (role, text) => {
    setMessages((prevMessages) => [...prevMessages, { role, text }]);
  };

  const annotateLastMessage = (annotations) => {
    setMessages((prevMessages) => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      const updatedLastMessage = {
        ...lastMessage,
      };
      annotations.forEach((annotation) => {
        if (annotation.type === 'file_path') {
          updatedLastMessage.text = updatedLastMessage.text.replaceAll(
            annotation.text,
            `/api/files/${annotation.file_path.file_id}`
          );
        }
      })
      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
    
  }

  return (
    <div className={styles.chatContainer}>
      {messages.length === 0 && (
        <div className={styles.chatHeader}>
          <h1>empleabot</h1>
          <p>Agrega tu CV y pregunta como:</p>
          <div className={styles.suggestionGrid}>
            <button 
              className={styles.suggestionButton}
              onClick={() => handleSuggestionClick("¿Qué áreas de mi CV necesitan mejora?")}
            >
              Mejorar mi CV
            </button>
            <button 
              className={styles.suggestionButton}
              onClick={() => handleSuggestionClick("¿Qué habilidades debería destacar?")}
            >
              Destacar habilidades
            </button>
            <button 
              className={styles.suggestionButton}
              onClick={() => handleSuggestionClick("¿Como Adaptar mi CV para el sector tecnológico?")}
            >
              Adaptar CV al sector tecnológico
            </button>
            <button 
              className={styles.suggestionButton}
              onClick={() => handleSuggestionClick("¿Faltan secciones importantes?")}
            >
              Resaltar secciones importantes
            </button>
          </div>
        </div>
      )}
      
      <div className={styles.messages}>
        <div className={styles.messagesContainer}>
          {messages.map((message, i) => (
            <div
              key={i}
              className={`${styles.messageWrapper} ${
                message.role === "user"
                  ? styles.userMessageWrapper
                  : styles.assistantMessageWrapper
              }`}
            >
              <div className={`${styles.avatar} ${
                message.role === "user" ? styles.userAvatar : ""
              }`}>
                {message.role === "user" ? (
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="white"/>
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L4 5V11.09C4 16.14 7.41 20.85 12 22C16.59 20.85 20 16.14 20 11.09V5L12 2ZM14 15H10V13H14V15ZM14 11H10V9H14V11Z" fill="#4A5D4B"/>
                  </svg>
                )}
              </div>
              <div
                className={
                  message.role === "user"
                    ? styles.userMessage
                    : styles.assistantMessage
                }
              >
                {message.role === "assistant" ? (
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    className={styles.markdown}
                    components={{
                      h1: ({node, ...props}) => <h1 className={styles.markdownH1} {...props} />,
                      h2: ({node, ...props}) => <h2 className={styles.markdownH2} {...props} />,
                      h3: ({node, ...props}) => <h3 className={styles.markdownH3} {...props} />,
                      p: ({node, ...props}) => <p className={styles.markdownP} {...props} />,
                      ul: ({node, ...props}) => <ul className={styles.markdownUl} {...props} />,
                      ol: ({node, ...props}) => <ol className={styles.markdownOl} {...props} />,
                      li: ({node, ...props}) => <li className={styles.markdownLi} {...props} />,
                      code: ({inline, className, children, ...props}: {
                        inline?: boolean;
                        className?: string;
                        children: React.ReactNode;
                      }) => 
                        inline ? 
                          <code className={styles.markdownInlineCode} {...props}>{children}</code> :
                          <div className={styles.markdownCodeBlock}>
                            <code {...props}>{children}</code>
                          </div>,
                      pre: ({node, ...props}) => <pre className={styles.markdownPre} {...props} />,
                      strong: ({node, ...props}) => <strong className={styles.markdownStrong} {...props} />,
                      em: ({node, ...props}) => <em className={styles.markdownEm} {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className={styles.markdownBlockquote} {...props} />,
                      a: ({node, ...props}) => <a className={styles.markdownLink} {...props} target="_blank" rel="noopener noreferrer" />
                    }}
                  >
                    {message.text}
                  </ReactMarkdown>
                ) : (
                  <div className={styles.plainText}>{message.text}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.inputForm}>
        {isProcessingPdf && (
          <div className={styles.processingFile}>
            <div className={styles.loadingSpinner}></div>
            Processing PDF...
          </div>
        )}
        {pdfError && (
          <div className={styles.errorMessage}>
            ⚠️ {pdfError}
          </div>
        )}
        {uploadedFileName && !isProcessingPdf && !pdfError && (
          <div className={styles.uploadedFile}>
            <span>📄 {uploadedFileName}</span>
            <button 
              type="button" 
              className={styles.removeFile}
              onClick={() => {
                setSelectedPdf(null);
                setUploadedFileName(null);
              }}
            >
              ✕
            </button>
          </div>
        )}
        <div className={styles.inputContainer}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePdfUpload}
            accept=".pdf"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className={`${styles.clipButton} ${isProcessingPdf ? styles.processing : ''}`}
            onClick={() => {
              setPdfError(null);
              fileInputRef.current?.click();
            }}
            disabled={inputDisabled || isProcessingPdf}
          >
            📎
          </button>
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={isProcessingPdf ? "Processing PDF..." : "Type your message..."}
            disabled={inputDisabled || isProcessingPdf}
            className={styles.input}
          />
          <button 
            type="submit" 
            disabled={inputDisabled || !userInput.trim() || isProcessingPdf}
            className={`${styles.button} ${isProcessingPdf ? styles.processing : ''}`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12L3 21L21 12L3 3L5 12ZM5 12L13 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
