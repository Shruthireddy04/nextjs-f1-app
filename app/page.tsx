'use client';

import { useChat } from '@ai-sdk/react';

export default function Page() {
  const { messages, input, handleSubmit, handleInputChange, status } =
    useChat();
  
   console.log(messages,"msg")

  return (
    <div className='top-form' >
      
      <div className='form-cnt'>
      {  messages.map(message => (
        <div className={`${message.role}`} key={message.id}>
          {/* <strong>{`${message.role}: `}</strong> */}
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text':
                return <span   key={index}>{part.text}</span>;

              // other cases can handle images, tool calls, etc
            }
          })}
      
        </div>
      ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          placeholder="Send a message..."
          onChange={handleInputChange}
          disabled={status !== 'ready'}
          className='input-ele'
        />
      </form>
    </div>
  );
}