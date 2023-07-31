import {
  ApolloClient,
  ApolloQueryResult,
  NormalizedCacheObject,
  gql,
} from "@apollo/client";
import { buildMimcSponge } from "circomlibjs";
import MerkleTree from "fixed-merkle-tree";

export default async function getExclusionTree(
  apolloClient: ApolloClient<NormalizedCacheObject>,
  blocklistedAddresses: string[],
  currency: string,
  amount: string
) {
  const commitments = await getBlocklistedCommitments(
    apolloClient,
    blocklistedAddresses,
    currency,
    amount
  );
  //TODO extract exclusion tree code into a separate module and use it in the backend code as well
  const exclusionTree = await buildExclusionTree(commitments);
  return exclusionTree;
}

async function getBlocklistedCommitments(
  apolloClient: ApolloClient<NormalizedCacheObject>,
  blocklistedAddresses: string[],
  currency: string,
  amount: string
) {
  const pageSize: number = 1000;
  const blocklistedCommitmentsQuery = gql`
    query Deposits(
      $limit: Int
      $offset: Int
      $amount: String
      $currency: String
      $blocklist: [String!]
    ) {
      deposits(
        orderBy: commitment
        first: $limit
        where: {
          amount: $amount
          currency: $currency
          index_gt: $offset
          from_in: $blocklist
        }
      ) {
        from
        commitment
        index
      }
    }
  `;

  var i = 0;
  var returnedCount = 0;
  var commitments: string[] = [];
  //TODO amount and currency from note
  do {
    await apolloClient
      .query({
        query: blocklistedCommitmentsQuery,
        variables: {
          limit: pageSize,
          offset: pageSize * i,
          currency: currency,
          amount: amount,
          blocklist: blocklistedAddresses,
        },
      })
      .then(function (result: ApolloQueryResult<any>) {
        returnedCount = result.data.deposits.length;
        commitments.push(
          ...result.data.deposits.map(
            (d: { commitment: string }) => d.commitment
          )
        );
        console.log(
          `Fetched ${pageSize * i + returnedCount} blocklisted commitments`
        );
        i++;
      })
      .catch((err) => {
        console.log("Error fetching blocklisted commitment data: ", err);
      });
  } while (returnedCount === pageSize);

  return commitments;
}

async function buildExclusionTree(commitments: string[]) {
  const mimcSponge = await buildMimcSponge();
  const exclusionTree = new MerkleTree(20, [], {
    hashFunction: (left, right) =>
      mimcSponge.F.toString(
        mimcSponge.multiHash([BigInt(left), BigInt(right)])
      ),
    zeroElement:
      "21663839004416932945382355908790599225266501822907911457504978515578255421292",
  });
  console.log("commitments", commitments);
  for (let j = 0; j < commitments.length - 1; j++) {
    if (j == 0) {
      exclusionTree.insert(BigInt(0).toString());
      exclusionTree.insert(commitments[0]);
    }
    exclusionTree.insert(commitments[j]);
    exclusionTree.insert(commitments[j + 1]);
  }
  exclusionTree.insert(
    exclusionTree.elements[exclusionTree.elements.length - 1]
  );
  exclusionTree.insert(
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
  );

  return exclusionTree;
}
