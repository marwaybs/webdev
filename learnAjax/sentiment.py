"""Demonstrates how to make a simple call to the Natural Language API."""

import argparse

from google.cloud import language


def print_result(annotations):
    score = annotations.sentiment.score
    magnitude = annotations.sentiment.magnitude
    print(score, magnitude)

##    for index, sentence in enumerate(annotations.sentences):
##        sentence_sentiment = sentence.sentiment.score
##        print('Sentence {} has a sentiment score of {}'.format(
##            index, sentence_sentiment))
##
##    print('Overall Sentiment: score of {} with magnitude of {}'.format(
##        score, magnitude))
##    return 0
##
##    print('Sentiment: score of {} with magnitude of {}'.format(
##        score, magnitude))
##    return 0


def analyze(text):
    """Run a sentiment analysis request on passed in string"""
    language_client = language.Client()

    # Instantiates a plain text document.
    document = language_client.document_from_html(text)

    # Detects sentiment in the document.
    annotations = document.annotate_text(include_sentiment=True,
                                         include_syntax=False,
                                         include_entities=False)

    # Print the results
    print_result(annotations)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("text")
    args = parser.parse_args()

    analyze(args.text)
