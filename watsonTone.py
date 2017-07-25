import json
from watson_developer_cloud import ToneAnalyzerV3


tone_analyzer = ToneAnalyzerV3(
    username='765fa715-b151-43b8-9e1c-8dc1c734c1db',
    password='2AjAEnnqvmWf',
    version='2016-02-11'

print(json.dumps(tone_analyzer.tone(text='I am very happy'), indent=2))

utterances = [{'text': 'I am very happy', 'user': 'glenn'}]
print(json.dumps(tone_analyzer.tone_chat(utterances), indent=2))
