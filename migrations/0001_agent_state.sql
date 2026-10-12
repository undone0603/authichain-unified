CREATE TABLE agent_memories (
  topic TEXT PRIMARY KEY, 
  content TEXT, 
  created_at INTEGER
);

CREATE TABLE agent_checkpoints (
  job_id TEXT PRIMARY KEY, 
  last_step INTEGER
);
