#!/usr/bin/env python3
"""Usage: seed-android.py <RKStorage> <seed.json> — writes the seed into a pulled AsyncStorage database."""
import json, sqlite3, sys
db = sqlite3.connect(sys.argv[1])
db.execute("delete from catalystLocalStorage where key = 'muscleos_active_workout'")
for key, value in json.load(open(sys.argv[2])).items():
    db.execute("insert or replace into catalystLocalStorage (key, value) values (?, ?)", (key, value))
db.commit()
