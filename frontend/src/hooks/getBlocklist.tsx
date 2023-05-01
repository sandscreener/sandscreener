import { useEffect, useState } from 'react';
import axios from 'axios';

type Blocklist = {
  blocklist: string[];
};

/**
 * Get the blocklist file from IPFS
 * @param cid CID of the blocklist file
 * @returns parsed blocklist JS
 */
const getBlocklist = (cid: string | undefined) => {
  const [data, setData] = useState<Blocklist | undefined>();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
      // Retrieve the file from IPFS
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          headers: {
            Accept: 'text/plain',
            'Accept-Encoding': 'gzip,deflate,compress',
          },
        });
        const rawBlocklist = Buffer.from(response.data, 'binary').toString(
          'utf8'
        );
        setData(JSON.parse(rawBlocklist));
      } catch (e: any) {
        setError(e);
      } finally {
        setLoading(false);
      }
    };
    if (cid) fetchData();
  }, [cid]);
  return { data, error, loading };
};

export default getBlocklist;
