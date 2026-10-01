"""The five pipeline stages, in run order.

Each is importable and runnable on its own, and each verifies its own work
before returning — a stage that cannot prove what it did raises rather than
printing a warning nobody reads.
"""
