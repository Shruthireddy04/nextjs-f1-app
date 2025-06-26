const Bubble=({message})=>{
    console.log("Messages rendering:", message);
    const {content,role}=message
    return (<div >{content}</div>)
}

export default Bubble;