import { useEffect, useState } from "react";
import feathers, { rest } from "@feathersjs/client";
import axios from "axios";
import createApplication from "@feathersjs/feathers";

/**
 * Get the Feathers client
 * @param production whether the environment is production or not
 * @returns Feathers client
 */
const getFeathersClient = (
  production: boolean
): createApplication.Application<any> | undefined => {
  const [feathersClient, setFeathersClient] =
    useState<createApplication.Application<any>>();

  useEffect(() => {
    const feathersClient = feathers();
    const restClient = rest(
      production
        ? process.env.NEXT_PUBLIC_BACKEND_ADDRESS
        : "http://localhost:3030"
    );
    feathersClient.configure(restClient.axios(axios));
    setFeathersClient(feathersClient);
  }, []);

  return feathersClient;
};

export default getFeathersClient;
