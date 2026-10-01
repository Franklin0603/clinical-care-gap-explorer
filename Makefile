# Everything a reviewer needs, in one place. `make` on its own lists these.
.DEFAULT_GOAL := help
PY := .venv/bin/python

help:  ## Show the available commands
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup:  ## Create the virtualenv and install dependencies
	python3 -m venv .venv
	$(PY) -m pip install -q -r requirements.txt
	cd web && npm install

run:  ## Rebuild the warehouse from data/raw  (~15s)
	$(PY) pipeline/run_all.py

generate:  ## Download Synthea, generate patients, then build  (~4min, needs Java 17)
	$(PY) pipeline/run_all.py --generate

fresh:  ## Delete the warehouse and rebuild it from scratch
	$(PY) pipeline/run_all.py --fresh

test: test-py test-web  ## Run every test

test-py:  ## Pipeline tests — reconciliation, cohort, catch rate, role scoping
	$(PY) -m pytest tests/ -q

test-web:  ## Web tests — the SQL guard and the question scope check
	cd web && node --test lib/*.test.ts

web:  ## Start the app at localhost:3000
	cd web && npm run dev

build:  ## Build the static site into web/out
	cd web && npm run build

.PHONY: help setup run generate fresh test test-py test-web web build
