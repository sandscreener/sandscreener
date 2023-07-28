import React from "react";
import { Button } from "react-bootstrap";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function Connect() {
  const { connector, isConnected } = useAccount();
  const { connect, connectors, error, isLoading, pendingConnector } =
    useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div style={{ padding: 5, margin: 5 }}>
      <div>
        {isConnected && (
          <Button onClick={() => disconnect()}>
            Disconnect from {connector?.name}
          </Button>
        )}

        {connectors
          .filter((x) => x.ready && x.id !== connector?.id)
          .map((x) => (
            <Button
              style={{ marginLeft: 5 }}
              key={x.id}
              onClick={() => connect({ connector: x })}
            >
              {x.name}
              {isLoading && x.id === pendingConnector?.id && " (connecting)"}
            </Button>
          ))}
      </div>

      {error && <div>{error.message}</div>}
    </div>
  );
}
