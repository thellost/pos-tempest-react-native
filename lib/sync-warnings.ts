import { Alert } from 'react-native';

import { captureError } from '@/lib/sentry';

let alertShown = false;
const droppedRows: { table: string; id: string; op: string; reason: string }[] = [];

/**
 * Called when an upload op references a row that the server will never accept
 * (e.g. integer-id ghost row pre-UUID migration, type-cast errors, FK to a row
 * that doesn't exist anywhere). The row has already been deleted from the local
 * SQLite by the connector. Here we:
 *   - Send a Sentry ERROR so the issue is visible in our dashboards
 *   - Show a one-shot popup to the user asking them to reset local data + sign in again
 */
export function notifyUnrecoverableUpload(args: {
  table: string;
  id: string;
  op: string;
  reason: string;
}) {
  droppedRows.push(args);

  captureError(
    new Error(
      `[sync] dropped unrecoverable upload row ${args.table}#${args.id} (${args.op}): ${args.reason}`,
    ),
    {
      module: 'powersync',
      operation: 'uploadData.dropUnrecoverable',
      level: 'error',
      extras: args,
    },
  );

  console.warn(
    `[sync] dropped ${args.op} ${args.table}#${args.id}: ${args.reason}`,
  );

  if (alertShown) return;
  alertShown = true;
  Alert.alert(
    'Sync Issue Detected',
    'Some unsynced data on this device could not be uploaded and was discarded to keep sync running.\n\nPlease go to Settings → Danger Zone → Reset Local Data & Sign Out, then sign back in.',
    [{ text: 'OK' }],
  );
}

export function getDroppedRows() {
  return [...droppedRows];
}
