import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useState, useRef, useEffect } from "react";
import {
	BrowserRouter,
	Routes,
	Route,
	Navigate,
	useParams,
	useNavigate,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

function CodeBlock({ content }: { content: string }) {
	// Detect code blocks (```language\ncode\n``` or `code`)
	const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/g);
	return (
		<div className="message-content">
			{parts.map((part, i) => {
				if (part.startsWith("```") && part.endsWith("```")) {
					const match = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
					const lang = match?.[1] || "";
					const code = match?.[2] || part.slice(3, -3);
					return (
						<pre key={i} className="code-block">
							{lang && <span className="code-lang">{lang}</span>}
							<code>{code}</code>
						</pre>
					);
				} else if (part.startsWith("`") && part.endsWith("`")) {
					return <code key={i} className="inline-code">{part.slice(1, -1)}</code>;
				}
				return <span key={i}>{part}</span>;
			})}
		</div>
	);
}

function Home() {
	const [roomCode, setRoomCode] = useState("");
	const navigate = useNavigate();

	const handleJoin = (e: React.FormEvent) => {
		e.preventDefault();
		const code = roomCode.trim().replace(/^\/+|\/+$/g, "");
		if (code) {
			navigate(`/${code}`);
		}
	};

	const handleCreate = () => {
		navigate(`/${nanoid()}`);
	};

	return (
		<div className="home container">
			<div className="home-content">
				<h1>Chat-Who</h1>
				<p>Pick or create a chat room to get started</p>
				<form onSubmit={handleJoin} className="room-form">
					<input
						type="text"
						value={roomCode}
						onChange={(e) => setRoomCode(e.target.value)}
						placeholder="Enter room code..."
						className="room-input"
					/>
					<button type="submit" className="room-btn join">
						Join
					</button>
				</form>
				<div className="divider">or</div>
				<button onClick={handleCreate} className="room-btn create">
					Create New Room
				</button>
			</div>
		</div>
	);
}

function App() {
	const [name] = useState(names[Math.floor(Math.random() * names.length)]);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const { room } = useParams();
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const socket = usePartySocket({
		party: "chat",
		room,
		onMessage: (evt) => {
			const message = JSON.parse(evt.data as string) as Message;
			if (message.type === "add") {
				const foundIndex = messages.findIndex((m) => m.id === message.id);
				if (foundIndex === -1) {
					// probably someone else who added a message
					setMessages((messages) => [
						...messages,
						{
							id: message.id,
							content: message.content,
							user: message.user,
							role: message.role,
						},
					]);
				} else {
					// this usually means we ourselves added a message
					// and it was broadcasted back
					// so let's replace the message with the new message
					setMessages((messages) => {
						return messages
							.slice(0, foundIndex)
							.concat({
								id: message.id,
								content: message.content,
								user: message.user,
								role: message.role,
							})
							.concat(messages.slice(foundIndex + 1));
					});
				}
			} else if (message.type === "update") {
				setMessages((messages) =>
					messages.map((m) =>
						m.id === message.id
							? {
									id: message.id,
									content: message.content,
									user: message.user,
									role: message.role,
								}
							: m,
					),
				);
			} else {
				setMessages(message.messages);
			}
		},
	});

	return (
		<div className="chat container">
			<div className="messages-list">
				{messages.map((message) => (
					<div key={message.id} className="row message">
						<div className="two columns user">{message.user}</div>
						<div className="ten columns">
							<CodeBlock content={message.content} />
						</div>
					</div>
				))}
				<div ref={messagesEndRef} />
			</div>
			<form
				className="row"
				onSubmit={(e) => {
					e.preventDefault();
					const content = e.currentTarget.elements.namedItem(
						"content",
					) as HTMLInputElement;
					const chatMessage: ChatMessage = {
						id: nanoid(8),
						content: content.value,
						user: name,
						role: "user",
					};
					setMessages((messages) => [...messages, chatMessage]);
					// we could broadcast the message here

					socket.send(
						JSON.stringify({
							type: "add",
							...chatMessage,
						} satisfies Message),
					);

					content.value = "";
				}}
			>
				<input
					type="text"
					name="content"
					className="ten columns my-input-text"
					placeholder={`Hello ${name}! Type a message...`}
					autoComplete="off"
				/>
				<button type="submit" className="send-message two columns">
					Send
				</button>
			</form>
		</div>
	);
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<Routes>
			<Route path="/" element={<Home />} />
			<Route path="/:room" element={<App />} />
			<Route path="*" element={<Navigate to="/" />} />
		</Routes>
	</BrowserRouter>,
);
