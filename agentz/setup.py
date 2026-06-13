from setuptools import setup, find_packages

setup(
    name="agentz-local",
    version="0.0.0",
    packages=find_packages(exclude=("tests", "tests.*")),
)
