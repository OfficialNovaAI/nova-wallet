"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
    Info,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    LucideIcon
} from "lucide-react";

interface InfoCardItem {
    label: string;
    value: string;
}

interface InfoCardProps {
    title: string;
    content?: string;
    items?: InfoCardItem[];
    type?: "info" | "success" | "warning" | "error";
    className?: string;
}

const typeConfig: Record<string, {
    icon: LucideIcon;
    bgClass: string;
    iconClass: string;
    borderClass: string;
}> = {
    info: {
        icon: Info,
        bgClass: "bg-blue-500/10",
        iconClass: "text-blue-500",
        borderClass: "border-blue-500/20",
    },
    success: {
        icon: CheckCircle2,
        bgClass: "bg-green-500/10",
        iconClass: "text-green-500",
        borderClass: "border-green-500/20",
    },
    warning: {
        icon: AlertTriangle,
        bgClass: "bg-yellow-500/10",
        iconClass: "text-yellow-500",
        borderClass: "border-yellow-500/20",
    },
    error: {
        icon: XCircle,
        bgClass: "bg-red-500/10",
        iconClass: "text-red-500",
        borderClass: "border-red-500/20",
    },
};

export function InfoCard({
    title,
    content,
    items,
    type = "info",
    className
}: InfoCardProps) {
    const config = typeConfig[type] || typeConfig.info;
    const Icon = config.icon;

    return (
        <div
            className={cn(
                "rounded-xl border p-4 my-2",
                config.bgClass,
                config.borderClass,
                className
            )}
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                    "p-1.5 rounded-lg",
                    config.bgClass
                )}>
                    <Icon className={cn("w-4 h-4", config.iconClass)} />
                </div>
                <h4 className="font-semibold text-sm">{title}</h4>
            </div>

            {/* Content */}
            {content && (
                <p className="text-sm text-muted-foreground mb-3">
                    {content}
                </p>
            )}

            {/* Items List */}
            {items && items.length > 0 && (
                <div className="space-y-2">
                    {items.map((item, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0"
                        >
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium">{item.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
