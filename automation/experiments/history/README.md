# Experiment History

Completed, supervised experiment decisions are written here as one immutable JSON record per experiment completion. `appendHistoryRecord` uses exclusive file creation and refuses to overwrite an existing record.

Raw Search Console queries must never be included. History contains only aggregate evidence already present in the experiment queue.
