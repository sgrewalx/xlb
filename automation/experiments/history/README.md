# Experiment History

Completed, supervised experiment decisions are written here as one immutable JSON record per experiment completion. `appendHistoryRecord` uses exclusive file creation and refuses to overwrite an existing record.

Raw Search Console queries must never be included. History contains only aggregate evidence already present in the experiment queue.

Experiment lifecycle is monotonic. Automated measurement may advance `measuring` to `evaluating`, but it cannot demote `evaluating` or alter its pending supervised decision. Only an explicit supervised action may move an evaluating experiment to `completed`, `paused`, or `rejected`.
