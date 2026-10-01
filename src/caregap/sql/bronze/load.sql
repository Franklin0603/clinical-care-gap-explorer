-- Bronze: a faithful copy of one Synthea export.
--
-- all_varchar is the point of this whole statement. Without it DuckDB samples
-- the first chunk of rows, infers a type per column, and then quietly nulls
-- anything later in the file that does not fit - no error, no warning, just a
-- smaller row count or a column of unexplained nulls. observations.VALUE holds
-- mostly numbers and some text, so type inference there is a coin flip about
-- which rows survive.
--
-- Typing happens in Silver, where a value that will not cast is quarantined
-- with a reason instead of disappearing.
--
-- _loaded_at and _source_file are the only additions. current_timestamp is
-- evaluated once per statement, so every row of a table shares a load time:
-- it stamps the load, not the row.

CREATE OR REPLACE TABLE bronze_{table} AS
SELECT *,
       current_timestamp AS _loaded_at,
       '{table}.csv'     AS _source_file
FROM read_csv_auto('{path}', all_varchar = true)
