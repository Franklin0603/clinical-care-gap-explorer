"""Can I reach the API, and is there a warehouse to query?

    make smoke

Three things differ from the obvious version, and all three are load-bearing:
the model (claude-sonnet-4-5 is deprecated), reading the text block by type
rather than taking content[0], and DB rather than cfg.warehouse_path, because
config has no cfg object.

smoke_test_hardened.py is the same two checks with every failure handled, and
explains why each guard is there.
"""

import anthropic
import duckdb
from dotenv import load_dotenv

from caregap.config import DB

load_dotenv()
client = anthropic.Anthropic()

resp = client.messages.create(
    model="claude-sonnet-5",
    max_tokens=100,
    messages=[{"role": "user", "content": "Say hello in five words."}],
)
print(next(b.text for b in resp.content if b.type == "text"))

con = duckdb.connect(str(DB), read_only=True)
print(con.execute("SELECT count(*) FROM care_gap_a1c").fetchone())
con.close()
