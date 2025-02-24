# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import absolute_import, print_function, unicode_literals

import sys

from mozunit import main
from mozbuild.util import (
    exec_,
    ReadOnlyNamespace,
)
from common import BaseConfigureTest


class TargetTest(BaseConfigureTest):
    def get_target(self, args, env={}):
        if 'linux' in self.HOST:
            platform = 'linux2'
        elif 'mingw' in self.HOST:
            platform = 'win32'
        else:
            raise Exception('Missing platform for HOST {}'.format(self.HOST))
        wrapped_sys = {}
        exec_('from sys import *', wrapped_sys)
        wrapped_sys['platform'] = platform
        modules = {
            'sys': ReadOnlyNamespace(**wrapped_sys),
        }
        sandbox = self.get_sandbox({}, {}, args, env, modules=modules)
        return sandbox._value_for(sandbox['target']).alias


class TestTargetLinux(TargetTest):
    def test_target(self):
        self.assertEqual(self.get_target([]), self.HOST)
        self.assertEqual(
            self.get_target(['--target=i686']),
            'i686-pc-linux-gnu')
        self.assertEqual(
            self.get_target(['--target=i686-unknown-linux-gnu']),
            'i686-unknown-linux-gnu')
        self.assertEqual(
            self.get_target(['--target=i686-pc-mingw32']),
            'i686-pc-mingw32')


class TestTargetWindows(TargetTest):
    # BaseConfigureTest uses this as the return value for config.guess
    HOST = 'i686-pc-mingw32'

    def test_target(self):
        self.assertEqual(self.get_target([]), self.HOST)
        self.assertEqual(
            self.get_target(['--target=x86_64-pc-mingw32']),
            'x86_64-pc-mingw32')
        self.assertEqual(
            self.get_target(['--target=x86_64']),
            'x86_64-pc-mingw32')

        # The tests above are actually not realistic, because most Windows
        # machines will have a few environment variables that make us not
        # use config.guess.

        # 32-bits process on x86_64 host.
        env = {
            'PROCESSOR_ARCHITECTURE': 'x86',
            'PROCESSOR_ARCHITEW6432': 'AMD64',
        }
        self.assertEqual(self.get_target([], env), 'x86_64-pc-mingw32')
        self.assertEqual(
            self.get_target(['--target=i686-pc-mingw32']),
            'i686-pc-mingw32')
        self.assertEqual(
            self.get_target(['--target=i686']),
            'i686-pc-mingw32')

        # 64-bits process on x86_64 host.
        env = {
            'PROCESSOR_ARCHITECTURE': 'AMD64',
        }
        self.assertEqual(self.get_target([], env), 'x86_64-pc-mingw32')
        self.assertEqual(
            self.get_target(['--target=i686-pc-mingw32']),
            'i686-pc-mingw32')
        self.assertEqual(
            self.get_target(['--target=i686']),
            'i686-pc-mingw32')

        # 32-bits process on x86 host.
        env = {
            'PROCESSOR_ARCHITECTURE': 'x86',
        }
        self.assertEqual(self.get_target([], env), 'i686-pc-mingw32')
        self.assertEqual(
            self.get_target(['--target=x86_64-pc-mingw32']),
            'x86_64-pc-mingw32')
        self.assertEqual(
            self.get_target(['--target=x86_64']),
            'x86_64-pc-mingw32')


class TestTargetAndroid(TargetTest):
    HOST = 'x86_64-pc-linux-gnu'

    def test_target(self):
        self.assertEqual(
            self.get_target(['--enable-project=mobile/android']),
            'arm-unknown-linux-androideabi')
        self.assertEqual(
            self.get_target(['--enable-project=mobile/android', '--target=i686']),
            'i686-unknown-linux-android')
        self.assertEqual(
            self.get_target(['--enable-project=mobile/android', '--target=x86_64']),
            'x86_64-unknown-linux-android')
        self.assertEqual(
            self.get_target(['--enable-project=mobile/android', '--target=aarch64']),
            'aarch64-unknown-linux-android')
        self.assertEqual(
            self.get_target(['--enable-project=mobile/android', '--target=arm']),
            'arm-unknown-linux-androideabi')


class TestMozConfigure(BaseConfigureTest):
    def test_nsis_version(self):
        this = self

        class FakeNSIS(object):
            def __init__(self, version):
                self.version = version

            def __call__(self, stdin, args):
                this.assertEquals(args, ('-version',))
                return 0, self.version, ''

        def check_nsis_version(version):
            sandbox = self.get_sandbox(
                {'/usr/bin/makensis': FakeNSIS(version)}, {}, [],
                {'PATH': '/usr/bin', 'MAKENSISU': '/usr/bin/makensis'})
            return sandbox._value_for(sandbox['nsis_version'])

        with self.assertRaises(SystemExit) as e:
            check_nsis_version('v2.5')

        with self.assertRaises(SystemExit) as e:
            check_nsis_version('v3.0a2')

        self.assertEquals(check_nsis_version('v3.0b1'), '3.0b1')
        self.assertEquals(check_nsis_version('v3.0b2'), '3.0b2')
        self.assertEquals(check_nsis_version('v3.0rc1'), '3.0rc1')
        self.assertEquals(check_nsis_version('v3.0'), '3.0')
        self.assertEquals(check_nsis_version('v3.0-2'), '3.0')
        self.assertEquals(check_nsis_version('v3.0.1'), '3.0')
        self.assertEquals(check_nsis_version('v3.1'), '3.1')


if __name__ == '__main__':
    main()
