"use client";

import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SendTransactionCardProps {
  type: "send";
  data: {
    token: string;
    amount: string;
    network: string;
    recipient: string;
    gasFee: string;
  };
  onCancel: () => void;
  onConfirm: () => void;
}

interface ReceiveTransactionCardProps {
  type: "receive";
  data: {
    address: string;
    token: string;
  };
  onClose: () => void;
}

interface SwapTransactionCardProps {
  type: "swap";
  data: {
    fromToken: string;
    fromAmount: string;
    toToken: string;
    toAmount: string;
    rate: string;
  };
  onCancel: () => void;
  onConfirm: () => void;
}

type TransactionCardProps = SendTransactionCardProps | ReceiveTransactionCardProps | SwapTransactionCardProps;

export const TransactionCard = (props: TransactionCardProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy address");
    }
  };

  if (props.type === "send") {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 max-w-sm mt-3">
        <h3 className="text-lg font-semibold text-center mb-6">Send Coin</h3>

        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Token</span>
            <span className="font-medium">{props.data.token}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">{props.data.amount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Network</span>
            <span className="font-medium">{props.data.network}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Recipient Address</span>
            <span className="font-medium font-mono text-xs">
              {props.data.recipient.slice(0, 6)}...{props.data.recipient.slice(-4)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gas Fee</span>
            <span className="font-medium">{props.data.gasFee}</span>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            className="flex-1 border-2 border-gray-300 text-gray-700 font-medium 
                       hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900
                       active:scale-95 transition-all duration-200"
            onClick={props.onCancel}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600 text-white font-medium
                       hover:from-purple-600 hover:to-violet-700 hover:shadow-lg hover:shadow-purple-500/30
                       active:scale-95 transition-all duration-200"
            onClick={props.onConfirm}
          >
            Send Confirm
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          By clicking Confirm, you approve this transaction in your wallet.
        </p>
      </div>
    );
  }

  if (props.type === "receive") {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 max-w-sm mt-3">
        <h3 className="text-lg font-semibold text-center mb-6">Receive {props.data.token}</h3>

        <div className="flex flex-col items-center">
          {/* QR Code */}
          <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center mb-4 p-4">
            <QRCodeSVG
              value={props.data.address}
              size={176}
              level="H"
              includeMargin={false}
            />
          </div>

          {/* Address with copy button */}
          <div className="w-full bg-muted rounded-lg p-3 mb-4">
            <p className="text-xs font-mono text-center break-all mb-2">
              {props.data.address}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => handleCopy(props.data.address)}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Address
                </>
              )}
            </Button>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full border-2 border-gray-300 text-gray-700 font-medium 
                     hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900
                     active:scale-95 transition-all duration-200"
          onClick={props.onClose}
        >
          Close
        </Button>
      </div>
    );
  }

  if (props.type === "swap") {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 max-w-sm mt-3">
        <h3 className="text-lg font-semibold text-center mb-6">Swap Tokens</h3>

        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">From</span>
            <span className="font-medium">{props.data.fromAmount} {props.data.fromToken}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">To</span>
            <span className="font-medium">{props.data.toAmount} {props.data.toToken}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Rate</span>
            <span className="font-medium">{props.data.rate}</span>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            className="flex-1 border-2 border-gray-300 text-gray-700 font-medium 
                       hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900
                       active:scale-95 transition-all duration-200"
            onClick={props.onCancel}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600 text-white font-medium
                       hover:from-purple-600 hover:to-violet-700 hover:shadow-lg hover:shadow-purple-500/30
                       active:scale-95 transition-all duration-200"
            onClick={props.onConfirm}
          >
            Confirm Swap
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
