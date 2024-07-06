from setuptools import setup, find_packages 
 
setup( 
    name='real_estate_direct', 
    version='1.0.0', 
    packages=find_packages(), 
    install_requires=[ 
        'Flask', 
        'SQLAlchemy' 
    ], 
    entry_points={ 
        'console_scripts': [ 
            'real_estate_direct=real_estate_direct.cli:main', 
        ], 
    }, 
) 
