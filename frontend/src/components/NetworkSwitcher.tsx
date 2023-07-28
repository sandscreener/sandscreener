import { Button } from "react-bootstrap";
import { useNetwork, useSwitchNetwork } from "wagmi";

export function NetworkSwitcher() {
  const { chain } = useNetwork();
  const { chains, error, isLoading, pendingChainId, switchNetwork } =
    useSwitchNetwork();

  return (
    <div style={{ padding: 5, margin: 5 }}>
      <div>
        Connected to {chain?.name ?? chain?.id}
        {chain?.unsupported && " (unsupported)"}
      </div>

      {switchNetwork && (
        <div>
          {chains.map((x) =>
            x.id === chain?.id ? null : (
              <Button
                style={{ marginRight: 5 }}
                key={x.id}
                onClick={() => switchNetwork(x.id)}
              >
                {x.name}
                {isLoading && x.id === pendingChainId && " (switching)"}
              </Button>
            )
          )}
        </div>
      )}

      <div>{error && error.message}</div>
    </div>
  );
}
