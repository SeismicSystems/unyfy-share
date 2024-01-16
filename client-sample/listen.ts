import { EventABIs, contractInterfaceSetup } from "./lib/utils";
import { W1_PRIV_KEY } from "./lib/constants";

/*
 * Prints all UnyfyDev events to stdout as they come.
 */
let [publicClient, contract] = contractInterfaceSetup(W1_PRIV_KEY);
Object.values(EventABIs).forEach((abi) => {
    publicClient.watchEvent({
        address: contract.address,
        event: abi,
        strict: true,
        onLogs: (logs: [any]) => {
            logs.forEach((log) =>
                console.log({ eventName: log["eventName"], args: log["args"] }),
            );
        },
    });
});
