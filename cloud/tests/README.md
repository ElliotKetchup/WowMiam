# Cloud tests

Run against the Firestore emulator (needs Java 21 and the app's own `node_modules`):

```sh
cd app && npm install        # the sync test bundles the app's code
cd ../cloud/tests && npm install && npm test
```

- `rules.test.mjs`: the security rules in `app/firestore.rules`: founding a book, joining with an
  invite (once, before it expires, at its rank), what each rank may do, leaving, removal, handing over
  the toque, deleting a book.
- `sync/`: the app's real `store.ts` + `cloud.ts`, bundled for Node with the native Firebase modules
  swapped for the web SDK (`sync/shims/`). Six "phones" run at once: Alice invites Bob (Sous-chef, who
  brings his recipes along) and Carol (Commis, then removed), Dave signs in with data from the old
  per-user sync, Erin has a personal book still named "Mon livre" (renamed after her), and Alice
  signs in on a second phone.
