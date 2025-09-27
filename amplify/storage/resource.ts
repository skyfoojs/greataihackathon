import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage(
  {
    name: 'medical-query-bucket',
    access: (allow) => ({
      'medical-records/*': [
        allow.authenticated.to(['read', 'write', 'delete'])
      ],
    }),
  }
);
