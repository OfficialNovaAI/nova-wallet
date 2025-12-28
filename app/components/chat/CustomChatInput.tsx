"use client";

import React, { useState, useRef, KeyboardEvent } from "react";
import { Sparkles, Send } from "lucide-react";
import { InputProps } from "@copilotkit/react-ui";

export function CustomChatInput({
    inProgress = false,
    onSend,
}: InputProps) {
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSend = () => {
        if (value.trim() && onSend && !inProgress) {
            onSend(value.trim());
            setValue("");
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <div
                className="flex items-center gap-3 bg-gray-100 
                           rounded-full px-4 py-3 shadow-sm"
            >
                {/* Sparkle Icon */}
                <Sparkles className="w-5 h-5 text-purple-500 flex-shrink-0" />

                {/* Input Field */}
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Nova AI about your wallet, markets, or transactions..."
                    disabled={inProgress}
                    className="flex-1 bg-transparent border-none outline-none 
                               text-sm text-gray-800 placeholder-gray-500
                               disabled:opacity-50"
                />

                {/* Send Button */}
                <button
                    onClick={handleSend}
                    disabled={!value.trim() || inProgress}
                    className="flex-shrink-0 w-9 h-9 rounded-full 
                               bg-gradient-to-r from-purple-500 to-violet-600 
                               flex items-center justify-center
                               disabled:opacity-50 disabled:cursor-not-allowed
                               hover:opacity-90 transition-opacity shadow-md"
                >
                    <Send className="w-4 h-4 text-white" />
                </button>
            </div>
        </div>
    );
}
