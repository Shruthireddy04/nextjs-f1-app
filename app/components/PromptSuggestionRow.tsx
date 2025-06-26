import PromptSuggestionButton from "./PromptSuggestionButton";

const PromptSuggestionRow=({onPromptClick})=>{
    const prompts=["Who will be newest driver for Ferrai?","Who is the highest paid F1 driver"  ]
    return (<div className="prompt-suggestion-row">
       {prompts?.map((prompt,index) => <PromptSuggestionButton key={index} text={prompt} onClick={()=>onPromptClick(prompt)}  />)}
    </div>)
}

export default PromptSuggestionRow;