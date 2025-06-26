'use client';
import Image from 'next/image';
import { useChat } from 'ai/react';
import { Message } from 'ai';
import f1log from './assets/F1-Logo.png';
import Bubble from './components/Bubble';
import LoadingBubble from './components/LoadingBubble';
import PromptSuggestionRow from './components/PromptSuggestionRow';

const Home = () => {
	const {
		messages,
		append,
		handleSubmit,
		handleInputChange,
		input,
		isLoading,
	} = useChat({
		api: '/api/chat',
    //streaming: true,
    id: "hello world" 
	});

	console.log(useChat())
  

	const noMessages = !messages || messages.length === 0;

	const handlePrompt = async (text: string) => {
		await append({ role: 'user', content: text });
	};

	console.log(messages, 'msg');
	return (
		<main>
			<Image src={f1log} width={250} alt="logo" />
			<section>
				{noMessages ? (
					<>
						<p className="starter-text">
							Formula One (F1) is the highest class of worldwide racing for
							open-wheel single-seater formula racing cars sanctioned by the
							Fédération Internationale de lAutomobile (FIA).{' '}
						</p>
						<br />
						<PromptSuggestionRow onPromptClick={handlePrompt} />
					</>
				) : (
					<>
						{messages.map((message, index) => (
							<Bubble message={message} key={index} />
						))}
						{isLoading && <LoadingBubble />}
					</>
				)}
			</section>
			<form onSubmit={handleSubmit}>
				<input
					onChange={handleInputChange}
					value={input}
					placeholder="Ask me Question!"
				/>
				<input type="submit" />
			</form>
		</main>
	);
};

export default Home;
