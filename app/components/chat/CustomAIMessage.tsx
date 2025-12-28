"use client";

import React from "react";
import { Zap, Loader2 } from "lucide-react";
import { AssistantMessageProps } from "@copilotkit/react-ui";

export function CustomAIMessage({ message, isLoading }: AssistantMessageProps) {
    // Handle content - CopilotKit's AIMessage.content is string | undefined
    const renderContent = () => {
        if (!message) return "";
        return message.content ?? "";
    };

    return (
        <div className="flex items-start gap-3 mb-4">
            {/* AI Avatar - Purple circle with lightning bolt */}
            <div
                className="flex-shrink-0 w-9 h-9 rounded-full 
                           bg-gradient-to-br from-purple-500 to-violet-600 
                           flex items-center justify-center shadow-md"
            >
                <Zap className="w-4 h-4 text-white fill-white" />
            </div>

            {/* Message Bubble */}
            <div
                className="bg-white border border-gray-200 rounded-2xl 
                           px-4 py-3 max-w-[80%] shadow-sm"
            >
                {isLoading ? (
                    <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                    </div>
                ) : (
                    <div className="text-sm leading-relaxed text-gray-800">
                        {renderContent()}
                    </div>
                )}
            </div>
        </div>
    );
}
