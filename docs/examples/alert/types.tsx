import { Alert } from "components-ui";

export default function Types() {
  return (
    <div className="space-y-3">
      <Alert type="info">Your trial ends in 5 days.</Alert>
      <Alert type="success">The invoice was sent.</Alert>
      <Alert type="warning">The export may take a few minutes.</Alert>
      <Alert type="danger">The payment was declined.</Alert>
    </div>
  );
}
