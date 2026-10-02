# Everything a reviewer needs, in one place. `make` on its own lists these.
.DEFAULT_GOAL := help
PY := .venv/bin/python
# Run through -m rather than the installed console script. pip's editable .pth
# can inherit the macOS hidden flag on a synced folder, and Python's site module
# skips hidden .pth files - so the package installs and then will not import.
# PYTHONPATH needs none of that and works straight after a clone.
RUN := PYTHONPATH=src $(PY) -m caregap

help:  ## Show the available commands
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup:  ## Create the virtualenv and install the package
	python3 -m venv .venv
	$(PY) -m pip install -q -e ".[dev]"
	cd web && npm install

run:  ## Rebuild the warehouse from data/raw  (~15s)
	$(RUN) run

generate:  ## Download Synthea, generate patients, then build  (~4min, needs Java 17)
	$(RUN) run --generate

fresh:  ## Delete the warehouse and rebuild it from scratch
	$(RUN) run --fresh

test: test-py test-web  ## Run every test

test-py:  ## Pipeline tests — reconciliation, cohort, catch rate, role scoping
	$(PY) -m pytest tests/ -q

test-web:  ## Web tests — the SQL guard and the question scope check
	cd web && node --test lib/*.test.ts

html:  ## Build the shareable HTML pages into docs/html/
	$(PY) tools/build_html.py

og:  ## Rebuild the social card from the pipeline's own reports
	$(PY) tools/build_og.py

smoke:  ## One Anthropic API call, to check the key works
	PYTHONPATH=src $(PY) -m caregap.scripts.smoke_test

web:  ## Start the app at localhost:3000
	cd web && npm run dev

build:  ## Build the static site into web/out
	cd web && npm run build

.PHONY: help setup run generate fresh test test-py test-web html og smoke web build
