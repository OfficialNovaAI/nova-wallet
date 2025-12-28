"use client";

import React from "react";
import { UserMessageProps } from "@copilotkit/react-ui";

export function CustomUserMessage({ message }: UserMessageProps) {
    // Handle content - can be string or array of content parts
    const renderContent = () => {
        if (!message) return "";
        if (typeof message.content === "string") {
            return message.content;
        }
        // If it's an array, extract text from text-type blocks
        return message.content
            .filter((part): part is { type: "text"; text: string } => part.type === "text")
            .map((part) => part.text)
            .join("");
    };

    return (
        <div className="flex justify-end mb-4">
            <div
                className="bg-gradient-to-r from-purple-500 to-violet-600 
                           text-white rounded-2xl px-5 py-3 
                           max-w-[80%] shadow-sm"
            >
                <div className="text-sm leading-relaxed">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}
