import React from 'react'

export default function PromptSuggestionButton({onClick,text}) {
  return (
    <button onClick={onClick} className="prompt-suggestion-button">
      {text}
    </button>
  )
}
